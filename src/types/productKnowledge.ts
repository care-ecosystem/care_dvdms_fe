export interface ProductKnowledgeCategory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface ProductKnowledgeSlugConfig {
  facility?: string;
  slug_value: string;
}

export interface ProductKnowledge {
  id: string;
  slug: string;
  slug_config?: ProductKnowledgeSlugConfig;
  alternate_identifier: string | null;
  status: string;
  product_type: string;
  name: string;
  category: ProductKnowledgeCategory | null;
}

export enum ResourceCategoryType {
  product_knowledge = "product_knowledge",
  charge_item_definition = "charge_item_definition",
  activity_definition = "activity_definition",
}

export interface ResourceCategoryParent {
  id: string;
  slug: string;
  title: string;
  parent?: ResourceCategoryParent;
}

export interface ResourceCategory {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  has_children?: boolean;
  parent?: ResourceCategoryParent;
}
