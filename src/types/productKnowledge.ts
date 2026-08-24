export interface ProductKnowledgeCategory {
  id: string;
  title: string;
  description: string | null;
}

export interface ProductKnowledge {
  id: string;
  slug: string;
  alternate_identifier: string | null;
  status: string;
  product_type: string;
  name: string;
  category: ProductKnowledgeCategory | null;
}
