import type { BehaviorDefinition, BehaviorType, Scene, SceneNode, Trait } from '@diorama/schema';
import type { R3fBehaviorRequirement } from './types';

const titleFromParams = (behavior: BehaviorDefinition): string | undefined => {
  const title = behavior.params?.title;
  return typeof title === 'string' ? title : behavior.label;
};

const descriptionFromParams = (behavior: BehaviorDefinition): string | undefined => {
  const description = behavior.params?.description;
  return typeof description === 'string' ? description : behavior.description;
};

const requirementFromBehavior = (behavior: BehaviorDefinition): R3fBehaviorRequirement => ({
  type: behavior.type,
  source: 'behavior',
  behaviorId: behavior.id,
  label: behavior.label,
  title: titleFromParams(behavior),
  description: descriptionFromParams(behavior),
});

const traitBehaviorTypes = (trait: Trait): BehaviorType[] => {
  switch (trait) {
    case 'clickable':
      return ['click_select'];
    case 'hoverable':
      return ['hover_highlight'];
    case 'focusable':
      return ['focus_camera'];
    case 'displayable':
      return ['show_info'];
    case 'seatable':
      return ['focus_camera', 'anchor_point'];
    case 'navigable':
      return ['focus_camera'];
    default: {
      const _exhaustive: never = trait;
      return _exhaustive;
    }
  }
};

const addRequirement = (
  requirements: R3fBehaviorRequirement[],
  next: R3fBehaviorRequirement,
): void => {
  if (requirements.some((r) => r.type === next.type)) return;
  requirements.push(next);
};

export const resolveBehaviorRequirements = (
  scene: Scene,
  node: SceneNode,
): R3fBehaviorRequirement[] => {
  const requirements: R3fBehaviorRequirement[] = [];
  const behaviors = scene.behaviors ?? {};
  const refs = node.behaviorRefs ?? [];
  const seenBehaviorIds = new Set<string>();

  for (const ref of refs) {
    const behavior = behaviors[ref];
    if (!behavior || !behavior.nodeIds.includes(node.id)) continue;
    seenBehaviorIds.add(behavior.id);
    addRequirement(requirements, requirementFromBehavior(behavior));
  }

  for (const behavior of Object.values(behaviors).sort((a, b) => a.id.localeCompare(b.id))) {
    if (seenBehaviorIds.has(behavior.id) || !behavior.nodeIds.includes(node.id)) continue;
    addRequirement(requirements, requirementFromBehavior(behavior));
  }

  const legacy = node.behaviors;
  if (legacy?.hoverHighlight === true) {
    addRequirement(requirements, { type: 'hover_highlight', source: 'legacy' });
  }
  if (legacy?.clickSelect === true) {
    addRequirement(requirements, { type: 'click_select', source: 'legacy' });
  }
  if (legacy?.focusOnClick === true) {
    addRequirement(requirements, { type: 'focus_camera', source: 'legacy' });
  }
  if (legacy?.info) {
    addRequirement(requirements, {
      type: 'show_info',
      source: 'legacy',
      title: legacy.info.title,
      description: legacy.info.description,
    });
  }

  for (const trait of node.semantics?.traits ?? []) {
    for (const type of traitBehaviorTypes(trait)) {
      addRequirement(requirements, { type, source: 'trait' });
    }
  }

  return requirements;
};

export const behaviorRequirementSummary = (requirements: R3fBehaviorRequirement[]): string =>
  requirements.map((r) => r.type).join(',');
