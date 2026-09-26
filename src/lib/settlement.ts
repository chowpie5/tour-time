import type { Settlement } from '../types';

export function computeSettlement(s: Settlement) {
  const gross = s.ticketPrice * s.ticketsSold;
  const net = gross - s.taxesAndFees;
  const splitPoint = net - s.showExpenses;
  const percentageDeal = Math.max(0, splitPoint) * (s.percentage / 100);
  let artistShow: number;
  if (s.dealType === 'guarantee') artistShow = s.guarantee;
  else if (s.dealType === 'versus') artistShow = Math.max(s.guarantee, percentageDeal);
  else artistShow = percentageDeal;
  const merchNet = s.merchGross * (1 - s.merchVenueCut / 100);
  const payout = artistShow - s.deductions;
  return { gross, net, splitPoint, percentageDeal, artistShow, merchNet, payout, total: payout + merchNet };
}
