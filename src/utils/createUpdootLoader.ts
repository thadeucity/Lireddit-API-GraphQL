import DataLoader from 'dataloader';
import { Updoot } from '../entities/Updoot';

export const createUpdootLoader = () =>
  new DataLoader<{ post_id: number; user_id: number }, Updoot | null>(
    async keys => {
      const updoots = await Updoot.findByIds(keys as any);

      const updootIdsToUpdoot: Record<string, Updoot> = {};
      updoots.forEach(updoot => {
        updootIdsToUpdoot[`${updoot.user_id}|${updoot.post_id}`] = updoot;
      });

      return keys.map(
        key => updootIdsToUpdoot[`${key.user_id}|${key.post_id}`],
      );
    },
  );
