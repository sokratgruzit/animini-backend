import { prisma } from '../client';
import { VideoStatus } from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';
import { CreateSeriesInput, CreateVideoInput } from '../utils/validation';

export class VideoService {
  /**
   * Create a new Series (Project container).
   * Now initialized with totalEarnings: 0 and no votes threshold.
   */
  public async createSeries(authorId: number, data: CreateSeriesInput) {
    return await prisma.series.create({
      data: {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        totalEarnings: VIDEO_ECONOMY.INITIAL_FUNDS,
        authorId,
      },
    });
  }

  /**
   * Fetch a single series by ID with nested videos and their funding progress.
   */
  public async getSeriesById(id: string) {
    return await prisma.series.findUnique({
      where: { id },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' },
          /**
           * We include funding fields: votesRequired, collectedFunds, isReleased
           */
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
  }

  /**
   * Create a Video episode within a specific series.
   * Initialized with a fixed funding threshold and locked status.
   */
  public async createVideo(authorId: number, data: CreateVideoInput) {
    return await prisma.video.create({
      data: {
        title: data.title,
        description: data.description,
        url: data.url,
        seriesId: data.seriesId,
        authorId,
        status: VideoStatus.DRAFT,
        // Funding logic applied at the video level
        votesRequired: VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD,
        collectedFunds: VIDEO_ECONOMY.INITIAL_FUNDS,
        isReleased: false,
      },
    });
  }

  /**
   * Fetch all series by author.
   * totalEarnings and video progress fields are now part of the response.
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
}

export const videoService = new VideoService();
