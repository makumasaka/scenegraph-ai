import { cloneSceneFromJson } from '../sceneJson';
import type { Scene } from '../types';
import { defaultFixtureScene } from './defaultScene';
import { galleryScene } from './gallery';
import { showroomScene } from './showroom';

export type StarterKitId = 'default' | 'showroom' | 'gallery';

export { defaultFixtureScene, showroomScene, galleryScene };

export const getStarterScene = (id: StarterKitId): Scene => {
  switch (id) {
    case 'showroom':
      return cloneSceneFromJson(showroomScene);
    case 'gallery':
      return cloneSceneFromJson(galleryScene);
    case 'default':
    default:
      return cloneSceneFromJson(defaultFixtureScene);
  }
};
