import { prisma } from '../client';
import { ReviewType } from '@prisma/client';
import { VIDEO_ECONOMY } from '../constants';

export class InteractionService {
  public async createReview(
    criticId: number,
    videoId: string,
    content: string,
    type: ReviewType
  ) {
    return await prisma.review.create({
      data: {
        criticId,
        videoId,
        content,
        type,
        votesRequired: VIDEO_ECONOMY.DEFAULT_REVIEW_THRESHOLD,
      },
    });
  }

  public async getReviewById(reviewId: string) {
    return await prisma.review.findUnique({
      where: { id: reviewId },
    });
  }
}

export const interactionService = new InteractionService();
