export type Product = {
  id: number;
  name: string;
  price_cents: number;
  quantity: number;
  active: boolean;
  image_path?: string | null;
  category_id?: number | null;
  category_name?: string | null;
};

export type OrderItemInput = {
  productId: number;
  quantity: number;
};

