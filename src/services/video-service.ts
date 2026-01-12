import { prisma } from '../client';
import { VideoStatus } from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';
import { eventService } from './event-service'; // Added SSE
import { CreateSeriesInput, CreateVideoInput } from '../utils/validation';

export class VideoService {
  /**
   * Create a new Series (Project container).
   * Notifies the author and broadcasts a new project announcement.
   */
  public async createSeries(authorId: number, data: CreateSeriesInput) {
    const series = await prisma.series.create({
      data: {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        totalEarnings: VIDEO_ECONOMY.INITIAL_FUNDS,
        authorId,
      },
    });

    // REACTIVE: Send success toast to author
    eventService.emitToUser(authorId, 'SERIES_CREATED', {
      id: series.id,
      title: series.title,
      message: `Series "${series.title}" created successfully!`,
    });

    // GLOBAL: Notify everyone about a new project
    eventService.broadcast('NEW_SERIES_AVAILABLE', {
      id: series.id,
      title: series.title,
      authorId: series.authorId,
    });

    return series;
  }

  /**
   * Fetch a single series by ID with nested videos.
   */
  public async getSeriesById(id: string) {
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: {
              select: { votes: true, reviews: true },
            },
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!series) throw new Error('Series not found');
    return series;
  }

  /**
   * Create a Video episode within a specific series.
   * Notifies author and updates the Series view in real-time.
   */
  public async createVideo(authorId: number, data: CreateVideoInput) {
    const video = await prisma.video.create({
      data: {
        title: data.title,
        description: data.description,
        url: data.url,
        seriesId: data.seriesId,
        authorId,
        status: VideoStatus.DRAFT,
        votesRequired: VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD,
        collectedFunds: VIDEO_ECONOMY.INITIAL_FUNDS,
        isReleased: false,
      },
    });

    // REACTIVE: Update the Author's workspace instantly
    eventService.emitToUser(authorId, 'VIDEO_CREATED', {
      id: video.id,
      seriesId: video.seriesId,
      title: video.title,
      message: `Episode "${video.title}" added to your series.`,
    });

    return video;
  }

  /**
   * Fetch all series by author.
   */
  public async getSeriesByAuthor(authorId: number) {
    return await prisma.series.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: {
              select: { votes: true, reviews: true },
            },
          },
        },
      },
    });
  }

  /**
   * NEW: Updates video status (e.g., from DRAFT to MODERATION)
   * This is critical for reactive UI state changes.
   */
  public async updateVideoStatus(videoId: string, status: VideoStatus) {
    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: { status },
    });

    // REACTIVE: Notify the author that their video is now under review or published
    eventService.emitToUser(updatedVideo.authorId, 'VIDEO_STATUS_UPDATED', {
      videoId: updatedVideo.id,
      status: updatedVideo.status,
      title: updatedVideo.title,
    });

    return updatedVideo;
  }
}

export const videoService = new VideoService();
