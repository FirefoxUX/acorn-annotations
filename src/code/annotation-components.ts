import {
  ANNOTATION_COMPONENT_KEY,
  ANNOTATION_COMPONENT_INFO_KEY,
} from '@src/defaults'
import {
  FIGMA_KIND_MAP,
  FIGMA_TYPE_MAP,
  KIND_FROM_FIGMA,
  TYPE_FROM_FIGMA,
  DEFAULT_VALUES,
  PROPERTY_KEYS,
} from '@src/shared-annotation-defaults'
import type { FigmaAnnotationKind, FigmaAnnotationType } from '@src/types'

// Property schema definitions for type safety and programmatic handling
type PropertySchema<T> = {
  key: string
  type: 'string' | 'boolean' | 'kind' | 'annotationType'
  defaultValue: T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fromFigma?: (value: any) => T
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toFigma?: (value: T) => any
}

// Property definitions for type safety
export interface AnnotationProperties {
  reference: string
  kind: FigmaAnnotationKind
  type: FigmaAnnotationType
}

export interface AnnotationInfoProperties {
  reference: string
  name: string
  role: string
  note: string
  componentName: string
  showComponentName: boolean
  kind: FigmaAnnotationKind
}

export class InstanceWrap {
  protected instanceNode: InstanceNode

  constructor(instanceNode: InstanceNode) {
    this.instanceNode = instanceNode
  }

  // Position and size methods using arrays
  setPosition(position: [number, number]): void {
    this.instanceNode.x = position[0]
    this.instanceNode.y = position[1]
  }

  getPosition(): [number, number] {
    return [this.instanceNode.x, this.instanceNode.y]
  }

  setSize(size: [number, number]): void {
    this.instanceNode.resize(size[0], size[1])
  }

  getSize(): [number, number] {
    return [this.instanceNode.width, this.instanceNode.height]
  }

  // Frame insertion methods
  insertIntoFrame(frame: FrameNode, index?: number): void {
    if (index !== undefined) {
      frame.insertChild(index, this.instanceNode)
    } else {
      frame.appendChild(this.instanceNode)
    }
  }

  removeFromParent(): void {
    this.instanceNode.remove()
  }

  // Access to underlying instance
  get instance(): InstanceNode {
    return this.instanceNode
  }

  get id(): string {
    return this.instanceNode.id
  }

  get locked(): boolean {
    return this.instanceNode.locked
  }

  set locked(value: boolean) {
    this.instanceNode.locked = value
  }

  // Generic property setter
  protected setProperties(properties: Record<string, string | boolean>): void {
    this.instanceNode.setProperties(properties)
  }
}

export class AnnotationWrap extends InstanceWrap {
  // Property schema for programmatic handling
  private static readonly SCHEMA: Record<
    keyof AnnotationProperties,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PropertySchema<any>
  > = {
    reference: {
      key: PROPERTY_KEYS.reference.annotation,
      type: 'string',
      defaultValue: DEFAULT_VALUES.reference,
    },
    kind: {
      key: PROPERTY_KEYS.kind,
      type: 'kind',
      defaultValue: DEFAULT_VALUES.kind,
      fromFigma: (value: string) =>
        KIND_FROM_FIGMA[value] || DEFAULT_VALUES.kind,
      toFigma: (value: FigmaAnnotationKind) => FIGMA_KIND_MAP[value],
    },
    type: {
      key: PROPERTY_KEYS.type,
      type: 'annotationType',
      defaultValue: DEFAULT_VALUES.type,
      fromFigma: (value: string) =>
        TYPE_FROM_FIGMA[value] || DEFAULT_VALUES.type,
      toFigma: (value: FigmaAnnotationType) => FIGMA_TYPE_MAP[value],
    },
  } as const

  constructor(instanceNode: InstanceNode) {
    super(instanceNode)
  }

  // Programmatic property getter
  private getProperty<K extends keyof AnnotationProperties>(
    prop: K,
  ): AnnotationProperties[K] {
    const schema = AnnotationWrap.SCHEMA[prop]
    const props = this.instanceNode.componentProperties as Record<
      string,
      { value: string | boolean }
    >
    const value = props?.[schema.key]?.value

    if (value !== undefined && schema.fromFigma) {
      return schema.fromFigma(value as string)
    }

    return value !== undefined
      ? (value as AnnotationProperties[K])
      : schema.defaultValue
  }

  // Individual property getters using getter functions
  get reference(): string {
    return this.getProperty('reference')
  }

  get kind(): FigmaAnnotationKind {
    return this.getProperty('kind')
  }

  get type(): FigmaAnnotationType {
    return this.getProperty('type')
  }

  // Programmatic property setters
  setReference(reference: string): void {
    this.setProperties({ [AnnotationWrap.SCHEMA.reference.key]: reference })
  }

  setKind(kind: FigmaAnnotationKind): void {
    const schema = AnnotationWrap.SCHEMA.kind
    this.setProperties({ [schema.key]: schema.toFigma!(kind) })
  }

  setType(type: FigmaAnnotationType): void {
    const schema = AnnotationWrap.SCHEMA.type
    this.setProperties({ [schema.key]: schema.toFigma!(type) })
  }

  // Programmatic bulk property update
  updateProperties(properties: Partial<AnnotationProperties>): void {
    const figmaProps: Record<string, string | boolean> = {}

    for (const [prop, value] of Object.entries(properties)) {
      if (value !== undefined) {
        const schema = AnnotationWrap.SCHEMA[prop as keyof AnnotationProperties]
        if (schema) {
          figmaProps[schema.key] = schema.toFigma
            ? schema.toFigma(value)
            : (value as string | boolean)
        }
      }
    }

    if (Object.keys(figmaProps).length > 0) {
      this.setProperties(figmaProps)
    }
  }

  static async create(
    position: [number, number],
    size: [number, number],
    targetFrame: FrameNode,
    properties?: Partial<AnnotationProperties>,
    index?: number,
    locked?: boolean,
  ): Promise<AnnotationWrap> {
    // Import the annotation component
    const component = await figma.importComponentByKeyAsync(
      ANNOTATION_COMPONENT_KEY,
    )

    // Create the instance
    const instance = component.createInstance()
    const wrap = new AnnotationWrap(instance)

    // Set position and size
    wrap.setPosition(position)
    wrap.setSize(size)

    // Set properties if provided
    if (properties) {
      wrap.updateProperties(properties)
    }

    if (locked !== undefined) {
      wrap.locked = locked
    }

    // Place in target frame
    wrap.insertIntoFrame(targetFrame, index)

    return wrap
  }

  static isOfType(node: PageNode | SceneNode): node is InstanceNode {
    return (
      node.type === 'INSTANCE' &&
      this.SCHEMA.reference.key in node.componentProperties &&
      this.SCHEMA.type.key in node.componentProperties
    )
  }
}

export class AnnotationInfoWrap extends InstanceWrap {
  // Property schema for programmatic handling
  private static readonly SCHEMA: Record<
    keyof AnnotationInfoProperties,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PropertySchema<any>
  > = {
    reference: {
      key: PROPERTY_KEYS.reference.info,
      type: 'string',
      defaultValue: DEFAULT_VALUES.reference,
    },
    name: {
      key: PROPERTY_KEYS.name,
      type: 'string',
      defaultValue: DEFAULT_VALUES.name,
    },
    role: {
      key: PROPERTY_KEYS.role,
      type: 'string',
      defaultValue: DEFAULT_VALUES.role,
    },
    note: {
      key: PROPERTY_KEYS.note,
      type: 'string',
      defaultValue: DEFAULT_VALUES.note,
    },
    componentName: {
      key: PROPERTY_KEYS.componentName,
      type: 'string',
      defaultValue: DEFAULT_VALUES.componentName,
    },
    showComponentName: {
      key: PROPERTY_KEYS.showComponentName,
      type: 'boolean',
      defaultValue: DEFAULT_VALUES.showComponentName,
    },
    kind: {
      key: PROPERTY_KEYS.kind,
      type: 'kind',
      defaultValue: DEFAULT_VALUES.kind,
      fromFigma: (value: string) =>
        KIND_FROM_FIGMA[value] || DEFAULT_VALUES.kind,
      toFigma: (value: FigmaAnnotationKind) => FIGMA_KIND_MAP[value],
    },
  } as const

  constructor(instanceNode: InstanceNode) {
    super(instanceNode)
  }

  static getDefaultProperty<K extends keyof AnnotationInfoProperties>(
    prop: K,
  ): AnnotationInfoProperties[K] {
    const schema = AnnotationInfoWrap.SCHEMA[prop]
    return schema.defaultValue
  }

  // Programmatic property getter
  private getProperty<K extends keyof AnnotationInfoProperties>(
    prop: K,
  ): AnnotationInfoProperties[K] {
    const schema = AnnotationInfoWrap.SCHEMA[prop]
    const props = this.instanceNode.componentProperties as Record<
      string,
      { value: string | boolean }
    >
    const value = props?.[schema.key]?.value

    if (value !== undefined && schema.fromFigma) {
      return schema.fromFigma(value as string)
    }

    return value !== undefined
      ? (value as AnnotationInfoProperties[K])
      : schema.defaultValue
  }

  // Individual property getters using getter functions
  get reference(): string {
    return this.getProperty('reference')
  }

  get name(): string {
    return this.getProperty('name')
  }

  get role(): string {
    return this.getProperty('role')
  }

  get note(): string {
    return this.getProperty('note')
  }

  get componentName(): string {
    return this.getProperty('componentName')
  }

  get showComponentName(): boolean {
    return this.getProperty('showComponentName')
  }

  get kind(): FigmaAnnotationKind {
    return this.getProperty('kind')
  }

  // Get all properties
  getProperties(): AnnotationInfoProperties {
    return {
      reference: this.reference,
      name: this.name,
      role: this.role,
      note: this.note,
      componentName: this.componentName,
      showComponentName: this.showComponentName,
      kind: this.kind,
    }
  }

  // Programmatic property setters
  setReference(reference: string): void {
    this.setProperties({ [AnnotationInfoWrap.SCHEMA.reference.key]: reference })
  }

  setName(name: string): void {
    this.setProperties({ [AnnotationInfoWrap.SCHEMA.name.key]: name })
  }

  setRole(role: string): void {
    this.setProperties({ [AnnotationInfoWrap.SCHEMA.role.key]: role })
  }

  setNote(note: string): void {
    this.setProperties({ [AnnotationInfoWrap.SCHEMA.note.key]: note })
  }

  setComponentName(componentName: string): void {
    this.setProperties({
      [AnnotationInfoWrap.SCHEMA.componentName.key]: componentName,
    })
  }

  setShowComponentName(show: boolean): void {
    this.setProperties({
      [AnnotationInfoWrap.SCHEMA.showComponentName.key]: show,
    })
  }

  setKind(kind: FigmaAnnotationKind): void {
    const schema = AnnotationInfoWrap.SCHEMA.kind
    this.setProperties({ [schema.key]: schema.toFigma!(kind) })
  }

  // Programmatic bulk property update
  updateProperties(properties: Partial<AnnotationInfoProperties>): void {
    const figmaProps: Record<string, string | boolean> = {}

    for (const [prop, value] of Object.entries(properties)) {
      if (value !== undefined) {
        const schema =
          AnnotationInfoWrap.SCHEMA[prop as keyof AnnotationInfoProperties]
        if (schema) {
          figmaProps[schema.key] = schema.toFigma
            ? schema.toFigma(value)
            : (value as string | boolean)
        }
      }
    }

    if (Object.keys(figmaProps).length > 0) {
      this.setProperties(figmaProps)
    }
  }

  // Async static method to create a new annotation info component with placement
  static async create(
    targetFrame: FrameNode,
    properties?: Partial<AnnotationInfoProperties>,
    index?: number,
    locked?: boolean,
  ): Promise<AnnotationInfoWrap> {
    // Import the annotation info component
    const component = await figma.importComponentByKeyAsync(
      ANNOTATION_COMPONENT_INFO_KEY,
    )

    // Create the instance
    const instance = component.createInstance()
    const wrap = new AnnotationInfoWrap(instance)

    // Set properties if provided
    if (properties) {
      wrap.updateProperties(properties)
    }

    if (locked !== undefined) {
      wrap.locked = locked
    }

    // Place in target frame
    wrap.insertIntoFrame(targetFrame, index)

    return wrap
  }

  // Helper method to get reference for sorting
  getReference(): string {
    return this.reference
  }

  static isOfType(node: PageNode | SceneNode): node is InstanceNode {
    return (
      node.type === 'INSTANCE' &&
      this.SCHEMA.reference.key in node.componentProperties &&
      this.SCHEMA.role.key in node.componentProperties
    )
  }
}
