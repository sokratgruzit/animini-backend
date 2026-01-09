import { Response } from 'express';
import { AuthRequest } from '../types/auth';
import { walletService } from '../services/wallet-service';
import { interactionService } from '../services/interaction-service';
import {
  voteVideoSchema,
  createReviewSchema,
  voteReviewSchema,
} from '../utils';

/**
 * Handle user voting for a specific video episode
 */
export const voteForVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { videoId, amount } = voteVideoSchema.parse(req.body);

    // walletService now returns video with included series data
    const updatedVideo = await walletService.processVideoVote(
      userId,
      videoId,
      amount
    );

    // FIX: Accessing economy data from the parent Series level
    return res.json({
      success: true,
      collectedFunds: updatedVideo.series.collectedFunds, // Economy moved here
      votesRequired: updatedVideo.series.votesRequired, // Economy moved here
      status: updatedVideo.status,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const postReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isCritic = req.user?.roles.includes('CRITIC');

    if (!userId || !isCritic) {
      return res
        .status(403)
        .json({ success: false, message: 'Only critics can post reviews' });
    }

    const { videoId, content, type } = createReviewSchema.parse(req.body);
    const review = await interactionService.createReview(
      userId,
      videoId,
      content,
      type
    );

    return res.status(201).json({ success: true, review });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const voteForReview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { reviewId } = voteReviewSchema.parse(req.body);
    const updatedReview = await walletService.processReviewVote(
      userId,
      reviewId
    );

    if (!updatedReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    return res.json({
      success: true,
      currentVotes: updatedReview.currentVotes,
      isExecuted: updatedReview.isExecuted,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, message: e.message });
  }
};
