export type Review = {
  id: string;
  marketId: string;
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  relativeTime: string;
  comment: string;
};

// No seeded reviews: market/[id].tsx and product/[id].tsx already render an empty state for
// reviewsFor(marketId).length === 0. Real reviews are submitted via app/review/[orderId].tsx, but those
// are recorded on the order itself (order.reviewRating), not pushed into this list — see contexts/order-context.tsx.
export const REVIEWS: Review[] = [];

export function reviewsFor(marketId: string): Review[] {
  return REVIEWS.filter((review) => review.marketId === marketId);
}

export function ratingDistribution(marketId: string): Record<1 | 2 | 3 | 4 | 5, number> {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviewsFor(marketId).forEach((review) => {
    distribution[review.rating] += 1;
  });
  return distribution;
}
