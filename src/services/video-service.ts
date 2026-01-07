import { prisma } from '../client';
import { VideoStatus } from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';

export class VideoService {
  public async createVideo(
    authorId: number,
    data: {
      title: string;
      description?: string;
      url: string;
      votesRequired?: number;
    }
  ) {
    return await prisma.video.create({
      data: {
        ...data,
        authorId,
        votesRequired:
          data.votesRequired ?? VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD,
        status: VideoStatus.MODERATION,
      },
    });
  }

  public async getVideosByAuthor(authorId: number) {
    return await prisma.video.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { votes: true, reviews: true },
        },
      },
    });
  }
}

export const videoService = new VideoService();
