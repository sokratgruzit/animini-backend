import { prisma } from '../client';
import {
  VideoStatus,
  TransactionType,
  TransactionStatus,
  Prisma,
} from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';
import { eventService } from './event-service';
import { walletService } from './wallet-service';
import { CreateSeriesInput, CreateVideoInput } from '../utils/validation';

export class VideoService {
  /**
   * PUBLIC FEED (DISCOVER)
   * Optimized to actually FIND your videos.
   */
  public async getPublicFeed(query: {
    cursor?: string;
    limit?: number;
    tags?: string[];
    type?: 'hot' | 'new' | 'completed' | 'most_funded';
  }) {
    const limit = query.limit || 10;
    const { cursor, tags, type } = query;

    // 1. Build dynamic filters
    // Changed: Simplified to ensure we don't block valid content
    const where: Prisma.SeriesWhereInput = {
      videos: {
        some: {
          // We show series if they have at least one video that is NOT a DRAFT
          status: { in: [VideoStatus.PUBLISHED] },
        },
      },
    };

    // Add tag filtering if present
    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // 2. Build sorting & special filters
    let orderBy: Prisma.SeriesOrderByWithRelationInput = { createdAt: 'desc' };

    if (type === 'completed') {
      // For completed, we ensure every video is released
      where.videos = {
        some: { status: VideoStatus.PUBLISHED },
        every: { isReleased: true },
      };
    } else if (type === 'hot' || type === 'most_funded') {
      orderBy = { totalEarnings: 'desc' };
    }

    // 3. Fetch data
    const series = await prisma.series.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where,
      orderBy,
      include: {
        author: {
          select: { name: true, avatarUrl: true },
        },
        videos: {
          orderBy: { createdAt: 'desc' },
          // We need all fields to calculate progress in JS
        },
      },
    });

    // 4. Transform into Snapshot format
    const items = series.map((s) => {
      // Logic: First try to find active funding, then fallback to latest released, then just first video
      const activeEpisode =
        s.videos.find(
          (v) => !v.isReleased && v.status === VideoStatus.PUBLISHED
        ) ||
        s.videos.find((v) => v.isReleased) ||
        s.videos[0];

      const releasedCount = s.videos.filter((v) => v.isReleased).length;

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        coverUrl: s.coverUrl,
        tags: s.tags,
        totalEarnings: s.totalEarnings,
        author: {
          name: s.author.name || 'Anonymous',
          avatar: s.author.avatarUrl,
        },
        activeEpisode: activeEpisode
          ? {
              id: activeEpisode.id,
              title: activeEpisode.title,
              progress:
                activeEpisode.votesRequired > 0
                  ? Math.floor(
                      (activeEpisode.collectedFunds /
                        activeEpisode.votesRequired) *
                        100
                    )
                  : 0,
              status: activeEpisode.status,
            }
          : null,
        stats: {
          totalEpisodes: s.videos.length,
          releasedCount,
        },
      };
    });

    const nextCursor =
      series.length === limit ? series[series.length - 1].id : null;

    return {
      items,
      nextCursor,
    };
  }

  public async createSeries(authorId: number, data: CreateSeriesInput) {
    const series = await prisma.series.create({
      data: {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        tags: data.tags || [],
        totalEarnings: 0,
        authorId,
      },
    });

    eventService.emitToUser(authorId, 'SERIES_CREATED', {
      id: series.id,
      title: series.title,
      message: `Series "${series.title}" created successfully!`,
    });

    return series;
  }

  public async createVideo(authorId: number, data: CreateVideoInput) {
    const fee = VIDEO_ECONOMY.CREATION_FEE || 500;

    const video = await prisma.$transaction(async (tx) => {
      const activeVideo = await tx.video.findFirst({
        where: {
          seriesId: data.seriesId,
          isReleased: false,
        },
      });

      if (activeVideo) {
        throw new Error(
          'Cannot add new episode: current episode is still in funding.'
        );
      }

      const author = await tx.user.findUnique({
        where: { id: authorId },
        select: { balance: true },
      });

      if (!author || author.balance < fee) {
        throw new Error(
          `Insufficient funds. Episode creation costs ${fee} coins.`
        );
      }

      await tx.user.update({
        where: { id: authorId },
        data: { balance: { decrement: fee } },
      });

      const newVideo = await tx.video.create({
        data: {
          title: data.title,
          description: data.description,
          url: data.url,
          seriesId: data.seriesId,
          authorId,
          status: VideoStatus.PUBLISHED, // Force Published so it appears in Discover
          votesRequired: VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD,
          collectedFunds: 0,
          isReleased: false,
        },
      });

      await tx.transaction.create({
        data: {
          userId: authorId,
          amount: fee,
          type: TransactionType.PLATFORM_FEE,
          status: TransactionStatus.COMPLETED,
          videoId: newVideo.id,
        },
      });

      return newVideo;
    });

    await walletService.notifyBalanceUpdate(authorId);
    return video;
  }

  public async getSeriesById(id: string) {
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { votes: true, reviews: true } },
          },
        },
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    if (!series) throw new Error('Series not found');
    return series;
  }

  public async getSeriesByAuthor(authorId: number) {
    return await prisma.series.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  public async updateVideoStatus(videoId: string, status: VideoStatus) {
    return await prisma.video.update({
      where: { id: videoId },
      data: { status },
    });
  }
}

export const videoService = new VideoService();
