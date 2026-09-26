import { useData, useActiveTour } from '../store';
import { sortDays } from './format';

export function useTourDays() {
  const data = useData();
  const tour = useActiveTour();
  return sortDays(data.days.filter((d) => d.tourId === tour?.id));
}
