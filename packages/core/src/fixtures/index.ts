import { cloneSceneFromJson } from '@diorama/schema';
import type { Scene } from '@diorama/schema';
import { defaultFixtureScene } from './defaultScene';
import { galleryScene } from './gallery';
import { livingSpaceScene } from './livingSpace';
import { showroomScene } from './showroom';

export type StarterKitId = 'default' | 'showroom' | 'gallery' | 'living';

export { defaultFixtureScene, showroomScene, galleryScene, livingSpaceScene };

export const getStarterScene = (id: StarterKitId): Scene => {
  switch (id) {
    case 'showroom':
      return cloneSceneFromJson(showroomScene);
    case 'gallery':
      return cloneSceneFromJson(galleryScene);
    case 'living':
      return cloneSceneFromJson(livingSpaceScene);
    case 'default':
    default:
      return cloneSceneFromJson(defaultFixtureScene);
  }
};
