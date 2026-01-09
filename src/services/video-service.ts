import { prisma } from '../client';
import { VideoStatus } from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';
import { CreateSeriesInput, CreateVideoInput } from '../utils/validation';

export class VideoService {
  /**
   * Create a new Series (Project container)
   */
  public async createSeries(authorId: number, data: CreateSeriesInput) {
    return await prisma.series.create({
      data: {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        votesRequired:
          data.votesRequired ?? VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD,
        authorId,
      },
    });
  }

  public async getSeriesById(id: string) {
    return await prisma.series.findUnique({
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
  }

  /**
   * Create a Video episode within a specific series
   */
  public async createVideo(authorId: number, data: CreateVideoInput) {
    return await prisma.video.create({
      data: {
        title: data.title,
        description: data.description,
        url: data.url,
        seriesId: data.seriesId,
        authorId,
        status: VideoStatus.DRAFT, // Default status for new episodes
      },
    });
  }

  /**
   * Fetch all series by author including nested videos and stats
   */
  public async getSeriesByAuthor(authorId: number) {
    return await prisma.series.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: {
          orderBy: { createdAt: 'asc' }, // Episodes usually follow chronological order
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
