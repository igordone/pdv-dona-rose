import type { GetServerSideProps } from "next";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { AdminLayout } from "../../components/AdminLayout";
import { useFeedback } from "../../components/Feedback";
import { requireAdminPageSession } from "../../lib/admin-access";

type CategoryItem = {
  id: number;
  name: string;
};

type ProductItem = {
  id: number;
  name: string;
  price_cents: number;
  cost_cents: number;
  brand: string | null;
  quantity: number;
  active: boolean;
  image_path: string | null;
  category_id: number | null;
  category_name: string | null;
};

type PurchaseCatalogItem = {
  id: number;
  name: string;
  brand: string | null;
  cost_cents: number;
  image_path: string | null;
  purchase_category_id: number | null;
  purchase_category_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PurchaseCategoryItem = {
  id: number;
  name: string;
};

type ModalMode = "category" | "product" | "edit" | null;
type ManagementSection = "cardapio" | "compras";

function formatPriceParts(cents: number) {
  const value = (cents / 100).toFixed(2);
  const [whole, decimal] = value.split(".");

  return { whole, decimal };
}

async function readJsonResponse<T>(response: Response): Promise<T | { error: string }> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return {
      error: text.trim() || "Resposta invalida do servidor.",
    };
  }

  return (await response.json()) as T | { error: string };
}

function normalizePriceInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes(",")) {
    return trimmed.replace(/\./g, "").replace(",", ".");
  }

  return trimmed;
}

function getCategoryIcon(category: string) {
  const normalized = category.trim().toLowerCase();

  if (normalized === "assados") {
    return "bakery_dining";
  }

  if (normalized === "fritos") {
    return "skillet";
  }

  if (normalized === "bebidas") {
    return "local_drink";
  }

  return "category";
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminRedirect = await requireAdminPageSession(context);
  if (adminRedirect) {
    return adminRedirect;
  }

  return { props: {} };
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15, 23, 42, 0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="card card-pad"
        style={{ width: "min(720px, 100%)", maxHeight: "90vh", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {title}
          </h2>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function GestaoPage() {
  const { toast, confirm } = useFeedback();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseCatalogItem[]>([]);
  const [purchaseCategories, setPurchaseCategories] = useState<PurchaseCategoryItem[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [categoryEditingId, setCategoryEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseCategoryName, setPurchaseCategoryName] = useState("");
  const [purchaseCategoryMessage, setPurchaseCategoryMessage] = useState("");
  const [purchaseCategoryEditingId, setPurchaseCategoryEditingId] = useState<number | null>(null);
  const [purchaseCategoryModalOpen, setPurchaseCategoryModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [managementSection, setManagementSection] = useState<ManagementSection>("cardapio");

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [stockStatus, setStockStatus] = useState("active");
  const [categoryId, setCategoryId] = useState("");
  const [imagePath, setImagePath] = useState("");

  const [purchaseName, setPurchaseName] = useState("");
  const [purchaseBrand, setPurchaseBrand] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseImagePath, setPurchaseImagePath] = useState("");
  const [purchaseCategoryId, setPurchaseCategoryId] = useState("");
  const [purchaseActive, setPurchaseActive] = useState(true);
  const [purchaseEditingId, setPurchaseEditingId] = useState<number | null>(null);
  const [purchaseModalMode, setPurchaseModalMode] = useState<"product" | "edit" | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(null);
  const [dropTargetCategoryId, setDropTargetCategoryId] = useState<number | null>(null);
  const [purchaseDraggedCategoryId, setPurchaseDraggedCategoryId] = useState<number | null>(null);
  const [purchaseDropTargetCategoryId, setPurchaseDropTargetCategoryId] = useState<number | null>(null);
  const [activeProductCategory, setActiveProductCategory] = useState("Todas");
  const [activePurchaseCategory, setActivePurchaseCategory] = useState("Todas");

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [editingProductId, products],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const product of products) {
      if (!product.category_id) continue;
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const productCategories = useMemo(() => ["Todas", ...categories.map((category) => category.name)], [categories]);

  const visibleProducts = useMemo(() => {
    if (activeProductCategory === "Todas") {
      return products;
    }

    return products.filter((product) => product.category_name === activeProductCategory);
  }, [activeProductCategory, products]);

  const combinedPurchaseCategories = useMemo(() => {
    const categoriesMap = new Map<
      string,
      {
        name: string;
        menuCount: number;
        purchaseCount: number;
        menuCategoryId: number | null;
        purchaseCategoryId: number | null;
        hasMenuSource: boolean;
        hasPurchaseSource: boolean;
      }
    >();

    for (const category of categories) {
      const key = category.name.trim().toLowerCase();
      const existing = categoriesMap.get(key);

      if (existing) {
        existing.hasMenuSource = true;
        existing.menuCategoryId = category.id;
        continue;
      }

      categoriesMap.set(key, {
        name: category.name,
        menuCount: categoryCounts.get(category.id) ?? 0,
        purchaseCount: 0,
        menuCategoryId: category.id,
        purchaseCategoryId: null,
        hasMenuSource: true,
        hasPurchaseSource: false,
      });
    }

    for (const category of purchaseCategories) {
      const key = category.name.trim().toLowerCase();
      const existing = categoriesMap.get(key);

      if (existing) {
        existing.hasPurchaseSource = true;
        existing.purchaseCategoryId = category.id;
        existing.purchaseCount += purchaseItems.filter(
          (item) => (item.purchase_category_name ?? "").trim().toLowerCase() === key,
        ).length;
        continue;
      }

      categoriesMap.set(key, {
        name: category.name,
        menuCount: 0,
        purchaseCount: purchaseItems.filter(
          (item) => (item.purchase_category_name ?? "").trim().toLowerCase() === key,
        ).length,
        menuCategoryId: null,
        purchaseCategoryId: category.id,
        hasMenuSource: false,
        hasPurchaseSource: true,
      });
    }

    return Array.from(categoriesMap.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [categories, categoryCounts, purchaseCategories, purchaseItems]);

  const combinedPurchaseCategoryFilters = useMemo(
    () => ["Todas", ...combinedPurchaseCategories.map((category) => category.name)],
    [combinedPurchaseCategories],
  );

  const combinedPurchaseItems = useMemo(() => {
    const merged = [
      ...products.map((product) => ({
        key: `menu:${product.id}`,
        sourceType: "menu" as const,
        id: product.id,
        name: product.name,
        brand: product.brand,
        cost_cents: product.cost_cents,
        image_path: product.image_path,
        active: product.active,
        category_name: product.category_name,
      })),
      ...purchaseItems.map((item) => ({
        key: `purchase:${item.id}`,
        sourceType: "purchase" as const,
        id: item.id,
        name: item.name,
        brand: item.brand,
        cost_cents: item.cost_cents,
        image_path: item.image_path,
        active: item.active,
        category_name: item.purchase_category_name,
      })),
    ];

    const filtered =
      activePurchaseCategory === "Todas"
        ? merged
        : merged.filter((item) => item.category_name === activePurchaseCategory);

    return filtered;
  }, [activePurchaseCategory, products, purchaseItems]);

  function reorderCategoryList(sourceId: number, targetId: number) {
    const nextCategories = [...categories];
    const sourceIndex = nextCategories.findIndex((category) => category.id === sourceId);
    const targetIndex = nextCategories.findIndex((category) => category.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return categories;
    }

    const [movedCategory] = nextCategories.splice(sourceIndex, 1);
    nextCategories.splice(targetIndex, 0, movedCategory);
    return nextCategories;
  }

  async function saveCategoryOrder(nextCategories: CategoryItem[]) {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderIds: nextCategories.map((category) => category.id) }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Falha ao reordenar categorias.");
    }
  }

  async function loadCategories() {
    const response = await fetch("/api/admin/categories");
    const data = (await readJsonResponse<{ items: CategoryItem[] }>(response)) as {
      items?: CategoryItem[];
      error?: string;
    };

    if (!response.ok) {
      setCategoryMessage(data.error ?? "Falha ao carregar categorias.");
      setCategories([]);
      return;
    }

    setCategories(data.items ?? []);
  }

  async function loadProducts() {
    const response = await fetch("/api/admin/products");
    const data = (await readJsonResponse<{ items: ProductItem[] }>(response)) as {
      items?: ProductItem[];
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Falha ao carregar produtos.");
      setProducts([]);
      return;
    }

    setProducts(data.items ?? []);
  }

  async function loadPurchaseCategories() {
    const response = await fetch("/api/admin/purchase-categories");
    const data = (await readJsonResponse<{ items: PurchaseCategoryItem[] }>(response)) as {
      items?: PurchaseCategoryItem[];
      error?: string;
    };

    if (!response.ok) {
      setPurchaseCategoryMessage(data.error ?? "Falha ao carregar categorias de compra.");
      setPurchaseCategories([]);
      return;
    }

    setPurchaseCategories(data.items ?? []);
  }

  async function loadPurchaseItems() {
    const response = await fetch("/api/admin/purchase-items");
    const data = (await readJsonResponse<{ items: PurchaseCatalogItem[] }>(response)) as {
      items?: PurchaseCatalogItem[];
      error?: string;
    };

    if (!response.ok) {
      setPurchaseMessage(data.error ?? "Falha ao carregar itens de compra.");
      setPurchaseItems([]);
      return;
    }

    setPurchaseItems(data.items ?? []);
  }

  useEffect(() => {
    void loadCategories().catch(() => setCategories([]));
    void loadProducts().catch(() => setProducts([]));
    void loadPurchaseCategories().catch(() => setPurchaseCategories([]));
    void loadPurchaseItems().catch(() => setPurchaseItems([]));
  }, []);

  function openCategoryModal() {
    setCategoryMessage("");
    setCategoryName("");
    setCategoryEditingId(null);
    setModalMode("category");
  }

  function openEditCategoryModal(category: CategoryItem) {
    setCategoryMessage("");
    setCategoryName(category.name);
    setCategoryEditingId(category.id);
    setModalMode("category");
  }

  function openProductModal() {
    setMessage("");
    setName("");
    setBrand("");
    setPrice("");
    setCost("");
    setQuantity("0");
    setStockStatus("active");
    setCategoryId(categories[0]?.id ? String(categories[0].id) : "");
    setImagePath("");
    setEditingProductId(null);
    setModalMode("product");
  }

  function openPurchaseItemModal() {
    setPurchaseMessage("");
    setPurchaseName("");
    setPurchaseBrand("");
    setPurchaseCost("");
    setPurchaseImagePath("");
    setPurchaseCategoryId(combinedPurchaseCategories[0]?.name ?? "");
    setPurchaseActive(true);
    setPurchaseEditingId(null);
    setPurchaseModalMode("product");
  }

  function openEditModal(product: ProductItem) {
    setMessage("");
    setEditingProductId(product.id);
    setName(product.name);
    setBrand(product.brand ?? "");
    setPrice((product.price_cents / 100).toFixed(2));
    setCost((product.cost_cents / 100).toFixed(2));
    setQuantity(String(product.quantity ?? 0));
    setStockStatus(product.active ? "active" : "inactive");
    setCategoryId(product.category_id ? String(product.category_id) : "");
    setImagePath(product.image_path ?? "");
    setModalMode("edit");
  }

  function openEditPurchaseItemModal(item: PurchaseCatalogItem) {
    setPurchaseMessage("");
    setPurchaseEditingId(item.id);
    setPurchaseName(item.name);
    setPurchaseBrand(item.brand ?? "");
    setPurchaseCost((item.cost_cents / 100).toFixed(2));
    setPurchaseImagePath(item.image_path ?? "");
    setPurchaseCategoryId(item.purchase_category_name ?? "");
    setPurchaseActive(item.active);
    setPurchaseModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingProductId(null);
    setCategoryEditingId(null);
    setQuantity("0");
  }

  function closePurchaseModal() {
    setPurchaseModalMode(null);
    setPurchaseEditingId(null);
    setPurchaseCategoryId("");
  }

  function reorderPurchaseCategoryList(sourceId: number, targetId: number) {
    const nextCategories = [...purchaseCategories];
    const sourceIndex = nextCategories.findIndex((category) => category.id === sourceId);
    const targetIndex = nextCategories.findIndex((category) => category.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return purchaseCategories;
    }

    const [movedCategory] = nextCategories.splice(sourceIndex, 1);
    nextCategories.splice(targetIndex, 0, movedCategory);
    return nextCategories;
  }

  async function savePurchaseCategoryOrder(nextCategories: PurchaseCategoryItem[]) {
    const response = await fetch("/api/admin/purchase-categories", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderIds: nextCategories.map((category) => category.id) }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Falha ao reordenar categorias de compra.");
    }
  }

  async function handleCategoryDrop(targetCategoryId: number) {
    if (draggedCategoryId === null || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null);
      setDropTargetCategoryId(null);
      return;
    }

    const nextCategories = reorderCategoryList(draggedCategoryId, targetCategoryId);
    setDraggedCategoryId(null);
    setDropTargetCategoryId(null);
    setCategories(nextCategories);

    try {
      await saveCategoryOrder(nextCategories);
      toast({
        title: "Categorias reordenadas",
        description: "A nova ordem foi salva com sucesso.",
        variant: "success",
      });
    } catch (error) {
      console.error("category_order_save_error", error);
      toast({
        title: "Não foi possível reordenar",
        description: "Tente novamente.",
        variant: "error",
      });
      await loadCategories();
    }
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryMessage("");

    const response = await fetch("/api/admin/categories", {
      method: categoryEditingId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: categoryEditingId, name: categoryName }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setCategoryMessage(data.error ?? "Falha ao salvar categoria.");
      toast({
        title: "Não foi possível salvar a categoria",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setCategoryMessage(categoryEditingId ? "Categoria atualizada com sucesso." : "Categoria cadastrada com sucesso.");
    toast({
      title: categoryEditingId ? "Categoria atualizada" : "Categoria criada",
      description: categoryName,
      variant: "success",
    });
    setCategoryName("");
    setCategoryEditingId(null);
    await loadCategories();
    await loadProducts();
    closeModal();
  }

  async function deleteCategory(categoryIdValue: number) {
    const confirmed = await confirm({
      title: "Remover categoria",
        description: "Essa ação vai excluir a categoria e os produtos ficarão sem categoria associada.",
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: categoryIdValue }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setCategoryMessage(data.error ?? "Falha ao remover categoria.");
      toast({
        title: "Falha ao remover a categoria",
        description: data.error ?? "Tente novamente.",
        variant: "error",
      });
      return;
    }

    setCategoryMessage("Categoria removida com sucesso.");
    toast({
      title: "Categoria removida",
      description: "A categoria foi excluida com sucesso.",
      variant: "success",
    });
    await loadCategories();
    await loadProducts();
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        brand,
        price,
        cost,
        quantity: Number(quantity || 0),
        categoryId: Number(categoryId),
        imagePath,
        active: stockStatus === "active",
      }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Falha ao cadastrar item.");
      toast({
        title: "Não foi possível criar o item",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setMessage("Item cadastrado com sucesso.");
    toast({
      title: "Item criado com sucesso",
      description: "O item foi adicionado ao cardápio.",
      variant: "success",
    });
    setName("");
    setBrand("");
    setPrice("");
    setCost("");
    setQuantity("0");
    setStockStatus("active");
    setCategoryId("");
    setImagePath("");
    await loadProducts();
    closeModal();
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!editingProduct) {
        setMessage("Produto selecionado inválido.");
      return;
    }

    const response = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editingProduct.id,
        name,
        brand,
        price,
        cost,
        quantity: Number(quantity || 0),
        categoryId: categoryId ? Number(categoryId) : null,
        imagePath,
        active: stockStatus === "active",
      }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Falha ao atualizar o produto.");
      toast({
        title: "Não foi possível atualizar o item",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setMessage("Item atualizado com sucesso.");
    toast({
      title: "Item atualizado",
      description: "As alterações foram salvas.",
      variant: "success",
    });
    await loadProducts();
    closeModal();
  }

  async function deleteProduct(productIdValue: number) {
    const confirmed = await confirm({
        title: "Excluir item do cardápio",
        description: "Essa ação remove o produto de vez. O histórico de pedidos e perdas continua preservado.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: productIdValue }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "Falha ao remover o produto.");
      toast({
        title: "Não foi possível excluir o item",
        description: data.error ?? "Tente novamente.",
        variant: "error",
      });
      return;
    }

    setMessage("Item removido com sucesso.");
    toast({
      title: "Item excluido",
      description: "O produto foi removido do cardápio.",
      variant: "success",
    });
    await loadProducts();
  }

  async function createPurchaseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPurchaseMessage("");

    const response = await fetch("/api/admin/purchase-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: purchaseName,
        brand: purchaseBrand,
        cost: purchaseCost,
        imagePath: purchaseImagePath,
        purchaseCategoryName: purchaseCategoryId || null,
        active: purchaseActive,
      }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setPurchaseMessage(data.error ?? "Falha ao cadastrar item de compra.");
      toast({
        title: "Não foi possível criar o item de compra",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setPurchaseMessage("Item de compra cadastrado com sucesso.");
    toast({
      title: "Item de compra criado",
      description: "O item foi adicionado ao catálogo de compras.",
      variant: "success",
    });
    setPurchaseName("");
    setPurchaseBrand("");
    setPurchaseCost("");
    setPurchaseImagePath("");
    setPurchaseCategoryId("");
    setPurchaseActive(true);
    await loadPurchaseItems();
    closePurchaseModal();
  }

  async function updatePurchaseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPurchaseMessage("");

    if (!purchaseEditingId) {
      setPurchaseMessage("Item selecionado inválido.");
      return;
    }

    const response = await fetch("/api/admin/purchase-items", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: purchaseEditingId,
        name: purchaseName,
        brand: purchaseBrand,
        cost: purchaseCost,
        imagePath: purchaseImagePath,
        purchaseCategoryName: purchaseCategoryId || null,
        active: purchaseActive,
      }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setPurchaseMessage(data.error ?? "Falha ao atualizar o item de compra.");
      toast({
        title: "Não foi possível atualizar o item",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setPurchaseMessage("Item de compra atualizado com sucesso.");
    toast({
      title: "Item de compra atualizado",
      description: "As alterações foram salvas.",
      variant: "success",
    });
    await loadPurchaseItems();
    closePurchaseModal();
  }

  async function deletePurchaseItem(itemId: number) {
    const confirmed = await confirm({
      title: "Excluir item de compra",
      description: "Esse item continuará existindo no histórico antigo, mas sairá do catálogo de compras.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/admin/purchase-items", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: itemId }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setPurchaseMessage(data.error ?? "Falha ao remover o item de compra.");
      toast({
        title: "Não foi possível excluir o item",
        description: data.error ?? "Tente novamente.",
        variant: "error",
      });
      return;
    }

    setPurchaseMessage("Item de compra removido com sucesso.");
    toast({
      title: "Item de compra excluído",
      description: "O item foi removido do catálogo.",
      variant: "success",
    });
    await loadPurchaseItems();
  }

  function openPurchaseCategoryModal() {
    setPurchaseCategoryMessage("");
    setPurchaseCategoryName("");
    setPurchaseCategoryEditingId(null);
    setPurchaseCategoryModalOpen(true);
  }

  function closePurchaseCategoryModal() {
    setPurchaseCategoryModalOpen(false);
    setPurchaseCategoryEditingId(null);
  }

  async function savePurchaseCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPurchaseCategoryMessage("");

    const response = await fetch("/api/admin/purchase-categories", {
      method: purchaseCategoryEditingId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: purchaseCategoryEditingId, name: purchaseCategoryName }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setPurchaseCategoryMessage(data.error ?? "Falha ao salvar categoria de compra.");
      toast({
        title: "Não foi possível salvar a categoria",
        description: data.error ?? "Verifique os dados e tente novamente.",
        variant: "error",
      });
      return;
    }

    setPurchaseCategoryMessage(
      purchaseCategoryEditingId ? "Categoria atualizada com sucesso." : "Categoria cadastrada com sucesso.",
    );
    toast({
      title: purchaseCategoryEditingId ? "Categoria atualizada" : "Categoria criada",
      description: purchaseCategoryName,
      variant: "success",
    });
    setPurchaseCategoryName("");
    setPurchaseCategoryEditingId(null);
    setPurchaseCategoryModalOpen(false);
    await loadPurchaseCategories();
    await loadPurchaseItems();
  }

  function editPurchaseCategory(category: PurchaseCategoryItem) {
    setPurchaseCategoryMessage("");
    setPurchaseCategoryName(category.name);
    setPurchaseCategoryEditingId(category.id);
    setPurchaseCategoryModalOpen(true);
  }

  async function deletePurchaseCategory(categoryIdValue: number) {
    const confirmed = await confirm({
      title: "Remover categoria de compra",
      description: "Os itens ligados a ela ficarão sem categoria, mas continuarão no catálogo.",
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/admin/purchase-categories", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: categoryIdValue }),
    });

    const data = (await readJsonResponse<{ error?: string }>(response)) as {
      error?: string;
    };

    if (!response.ok) {
      setPurchaseCategoryMessage(data.error ?? "Falha ao remover a categoria de compra.");
      toast({
        title: "Não foi possível remover a categoria",
        description: data.error ?? "Tente novamente.",
        variant: "error",
      });
      return;
    }

    setPurchaseCategoryMessage("Categoria de compra removida com sucesso.");
    toast({
      title: "Categoria removida",
      description: "A categoria foi excluída com sucesso.",
      variant: "success",
    });
    await loadPurchaseCategories();
    await loadPurchaseItems();
  }

  async function handlePurchaseCategoryDrop(targetCategoryId: number) {
    if (purchaseDraggedCategoryId === null || purchaseDraggedCategoryId === targetCategoryId) {
      setPurchaseDraggedCategoryId(null);
      setPurchaseDropTargetCategoryId(null);
      return;
    }

    const nextCategories = reorderPurchaseCategoryList(purchaseDraggedCategoryId, targetCategoryId);
    setPurchaseDraggedCategoryId(null);
    setPurchaseDropTargetCategoryId(null);
    setPurchaseCategories(nextCategories);

    try {
      await savePurchaseCategoryOrder(nextCategories);
      toast({
        title: "Categorias de compra reordenadas",
        description: "A nova ordem foi salva com sucesso.",
        variant: "success",
      });
    } catch (error) {
      console.error("purchase_category_order_save_error", error);
      toast({
        title: "Não foi possível reordenar",
        description: "Tente novamente.",
        variant: "error",
      });
      await loadPurchaseCategories();
    }
  }

  return (
    <>
      <AdminLayout title="Gestão de Categorias e Itens" subtitle="Categorias e itens do cardápio com edição rápida.">
        <div className="grid" style={{ gap: 40 }}>
          <div className="modal-choice-strip" style={{ width: "fit-content" }}>
            {[
              { key: "cardapio", label: "Cardápio", icon: "restaurant_menu" },
              { key: "compras", label: "Compras", icon: "shopping_bag" },
            ].map((tab) => {
              const active = managementSection === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`modal-choice-chip${active ? " is-active" : ""}`}
                  onClick={() => setManagementSection(tab.key as ManagementSection)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            style={
              managementSection === "cardapio"
                ? { display: "grid", gap: 48 }
                : { display: "none" }
            }
          >
            <section style={{ display: "grid", gap: 48 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h2 className="section-title" style={{ marginBottom: 4 }}>
                    Categorias
                  </h2>
                    <p className="subtitle" style={{ margin: 0 }}>
                      {categories.length} categorias · arraste para reordenar
                    </p>
                </div>
                <button className="btn btn-primary" type="button" onClick={openCategoryModal}>
                  Criar categorias
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
            {categories.map((category) => (
              <article
                key={category.id}
                className={`card admin-category-card${draggedCategoryId === category.id ? " is-dragging" : ""}${
                  dropTargetCategoryId === category.id && draggedCategoryId !== category.id ? " is-drop-target" : ""
                }`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(category.id));
                  setDraggedCategoryId(category.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (draggedCategoryId !== category.id) {
                    setDropTargetCategoryId(category.id);
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (draggedCategoryId !== category.id) {
                    setDropTargetCategoryId(category.id);
                  }
                }}
                onDragLeave={() => {
                  if (dropTargetCategoryId === category.id) {
                    setDropTargetCategoryId(null);
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  await handleCategoryDrop(category.id);
                }}
                onDragEnd={() => {
                  setDraggedCategoryId(null);
                  setDropTargetCategoryId(null);
                }}
                style={{
                  minHeight: 162,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 15, color: "var(--text)" }}>{category.name}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {categoryCounts.get(category.id) ?? 0} itens
                    </div>
                  </div>
                  <div
                    className="admin-drag-handle"
                    aria-hidden="true"
                      title="Arraste para reordenar"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 -960 960 960"
                      role="img"
                      focusable="false"
                      aria-hidden="true"
                    >
                      <path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z" />
                    </svg>
                  </div>
                </div>

                <div style={{ flex: 1 }} />

                <div className="admin-card-footer">
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                    {categoryCounts.get(category.id) ?? 0} itens
                  </div>
                  <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                    <button
                      type="button"
                      onClick={() => openEditCategoryModal(category)}
                      aria-label={`Editar categoria ${category.name}`}
                      className="btn-icon"
                      title="Editar"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
                      aria-label={`Remover categoria ${category.name}`}
                      className="btn-icon btn-icon--danger"
                      title="Remover"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Cardápio
              </h2>
              <p className="subtitle" style={{ margin: 0 }}>
                {visibleProducts.length} itens cadastrados
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="button" onClick={openProductModal}>
                Criar item
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div className="admin-category-strip">
              {productCategories.map((category) => {
                const active = activeProductCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    className={`public-category-chip admin-category-chip${active ? " is-active" : ""}`}
                    onClick={() => setActiveProductCategory(category)}
                    aria-pressed={active}
                    style={{
                      background: active ? "var(--brand)" : "transparent",
                      color: active ? "#fff" : "var(--text)",
                      padding: "7px 16px",
                      borderRadius: 8,
                      border: "none",
                      boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
                    }}
                  >
                    {category !== "Todas" ? (
                      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>
                        {getCategoryIcon(category)}
                      </span>
                    ) : null}
                    {category}
                  </button>
                );
              })}
            </div>

            <div className="muted" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              {visibleProducts.length} itens
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 14,
              justifyContent: "start",
            }}
          >
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="card admin-product-card"
                style={{
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  padding: 0,
                }}
              >
                <div style={{ padding: 8, paddingBottom: 0 }}>
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "1.28 / 1",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {product.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_path}
                        alt={product.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--muted)",
                          fontWeight: 700,
                          background:
                            "repeating-linear-gradient(135deg, rgba(249,115,22,0.1) 0 10px, rgba(231,229,228,0.75) 10px 20px)",
                        }}
                      >
                        Sem imagem
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-product-card-body">
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {product.category_name ?? "Sem categoria"}
                  </div>
                  {product.brand ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>
                      {product.brand}
                    </div>
                  ) : null}
                  <div className="admin-product-card-title">
                    {product.name}
                  </div>
                  <div className="admin-product-card-description">
                    {product.active ? "Item ativo no cardápio." : "Item inativo no cardápio."}
                  </div>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "var(--surface-2)",
                      color: "var(--muted)",
                      fontSize: 12,
                      fontWeight: 700,
                      width: "fit-content",
                    }}
                    title="Quantidade em estoque"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>
                      inventory_2
                    </span>
                    <span>Qtd: {product.quantity}</span>
                  </div>

                  <div className="admin-card-footer" style={{ marginTop: 8 }}>
                    <div className="admin-price">
                      <span className="admin-price-currency">R$</span>
                      <span className="admin-price-value">{formatPriceParts(product.price_cents).whole}</span>
                      <span className="admin-price-decimal">.{formatPriceParts(product.price_cents).decimal}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                      <button
                        className="btn-icon"
                        type="button"
                        onClick={() => openEditModal(product)}
                        title="Editar"
                        aria-label={`Editar produto ${product.name}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          edit
                        </span>
                      </button>
                      <button
                        className="btn-icon btn-icon--danger"
                        type="button"
                        onClick={() => deleteProduct(product.id)}
                        title="Remover"
                        aria-label={`Remover produto ${product.name}`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
          </div>

          <div style={managementSection === "compras" ? undefined : { display: "none" }}>
            <section style={{ display: "grid", gap: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <h2 className="section-title" style={{ marginBottom: 4 }}>
                    Compras
                  </h2>
                </div>
                <button className="btn btn-primary" type="button" onClick={openPurchaseItemModal}>
                  Registrar novo item
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div className="losses-toolbar" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                      Categorias
                    </h3>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={openPurchaseCategoryModal}>
                    Criar categorias
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 14,
                  }}
                >
                  {combinedPurchaseCategories.map((category) => {
                    const isCustomCategory = Boolean(category.hasPurchaseSource);
                    const badgeLabel = category.hasMenuSource && category.hasPurchaseSource
                      ? "Cardápio + Compras"
                      : category.hasMenuSource
                        ? "Cardápio"
                        : "Compras";
                    const totalCount = category.menuCount + category.purchaseCount;

                    return (
                      <article
                        key={category.name}
                        className={`card admin-category-card${purchaseDraggedCategoryId === category.purchaseCategoryId ? " is-dragging" : ""}${
                          purchaseDropTargetCategoryId === category.purchaseCategoryId &&
                          purchaseDraggedCategoryId !== category.purchaseCategoryId
                            ? " is-drop-target"
                            : ""
                        }`}
                        draggable={isCustomCategory && Boolean(category.purchaseCategoryId)}
                        onDragStart={
                          isCustomCategory && category.purchaseCategoryId
                            ? (event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", String(category.purchaseCategoryId));
                                setPurchaseDraggedCategoryId(category.purchaseCategoryId);
                              }
                            : undefined
                        }
                        onDragOver={
                          isCustomCategory && category.purchaseCategoryId
                            ? (event) => {
                                event.preventDefault();
                                if (purchaseDraggedCategoryId !== category.purchaseCategoryId) {
                                  setPurchaseDropTargetCategoryId(category.purchaseCategoryId);
                                }
                              }
                            : undefined
                        }
                        onDragEnter={
                          isCustomCategory && category.purchaseCategoryId
                            ? (event) => {
                                event.preventDefault();
                                if (purchaseDraggedCategoryId !== category.purchaseCategoryId) {
                                  setPurchaseDropTargetCategoryId(category.purchaseCategoryId);
                                }
                              }
                            : undefined
                        }
                        onDragLeave={
                          isCustomCategory && category.purchaseCategoryId
                            ? () => {
                                if (purchaseDropTargetCategoryId === category.purchaseCategoryId) {
                                  setPurchaseDropTargetCategoryId(null);
                                }
                              }
                            : undefined
                        }
                        onDrop={
                          isCustomCategory && category.purchaseCategoryId
                            ? async (event) => {
                                event.preventDefault();
                                const purchaseCategoryId = category.purchaseCategoryId;
                                if (purchaseCategoryId) {
                                  await handlePurchaseCategoryDrop(purchaseCategoryId);
                                }
                              }
                            : undefined
                        }
                        onDragEnd={
                          isCustomCategory && category.purchaseCategoryId
                            ? () => {
                                setPurchaseDraggedCategoryId(null);
                                setPurchaseDropTargetCategoryId(null);
                              }
                            : undefined
                        }
                        style={{
                          minHeight: 162,
                          padding: 14,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div>
                            <strong style={{ fontSize: 15, color: "var(--text)" }}>{category.name}</strong>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                              {totalCount} itens
                            </div>
                          </div>
                          <span className="pill" style={{ whiteSpace: "nowrap" }}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div style={{ flex: 1 }} />

                        <div className="admin-card-footer">
                          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                            {isCustomCategory ? "Categoria de compra" : "Herdada do cardápio"}
                          </div>
                          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            {isCustomCategory && category.purchaseCategoryId ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const categoryItem = purchaseCategories.find((item) => item.id === category.purchaseCategoryId);
                                    if (categoryItem) {
                                      editPurchaseCategory(categoryItem);
                                    }
                                  }}
                                  aria-label={`Editar categoria ${category.name}`}
                                  className="btn-icon"
                                  title="Editar"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePurchaseCategory(category.purchaseCategoryId!)}
                                  aria-label={`Remover categoria ${category.name}`}
                                  className="btn-icon btn-icon--danger"
                                  title="Remover"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                    delete
                                  </span>
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div className="losses-toolbar" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                      Itens
                    </h3>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div className="admin-category-strip">
                    {combinedPurchaseCategoryFilters.map((category) => {
                      const active = activePurchaseCategory === category;

                      return (
                        <button
                          key={category}
                          type="button"
                          className={`public-category-chip admin-category-chip${active ? " is-active" : ""}`}
                          onClick={() => setActivePurchaseCategory(category)}
                          aria-pressed={active}
                          style={{
                            background: active ? "var(--brand)" : "transparent",
                            color: active ? "#fff" : "var(--text)",
                            padding: "7px 16px",
                            borderRadius: 8,
                            border: "none",
                            boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
                          }}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>

                  <div className="muted" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                    {combinedPurchaseItems.length} itens
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                    gap: 14,
                    justifyContent: "start",
                  }}
                >
                  {combinedPurchaseItems.map((item) => (
                    <article
                      key={item.key}
                      className="card admin-product-card"
                      style={{
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        padding: 0,
                      }}
                    >
                      <div style={{ padding: 8, paddingBottom: 0 }}>
                        <div
                          style={{
                            position: "relative",
                            aspectRatio: "1.28 / 1",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "var(--surface-2)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          {item.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_path}
                              alt={item.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                                color: "var(--muted)",
                                fontWeight: 700,
                                background:
                                  "repeating-linear-gradient(135deg, rgba(249,115,22,0.1) 0 10px, rgba(231,229,228,0.75) 10px 20px)",
                              }}
                            >
                              Sem imagem
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="admin-product-card-body">
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                          {item.category_name ?? "Sem categoria"}
                        </div>
                        {item.brand ? (
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginTop: 4 }}>
                            {item.brand}
                          </div>
                        ) : null}
                        <div className="admin-product-card-title">{item.name}</div>
                        <div className="admin-product-card-description">
                          {item.sourceType === "menu"
                            ? "Herdado do cardápio."
                            : item.active
                              ? "Item ativo no catálogo de compras."
                              : "Item inativo no catálogo de compras."}
                        </div>

                        <div className="admin-card-footer" style={{ marginTop: 8 }}>
                          <div className="admin-price">
                            <span className="admin-price-currency">R$</span>
                            <span className="admin-price-value">{formatPriceParts(item.cost_cents).whole}</span>
                            <span className="admin-price-decimal">.{formatPriceParts(item.cost_cents).decimal}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            <span className="pill">{item.sourceType === "menu" ? "Cardápio" : "Compras"}</span>
                            {item.sourceType === "purchase" ? (
                              <>
                                <button
                                  className="btn-icon"
                                  type="button"
                                  onClick={() => {
                                    const purchaseItem = purchaseItems.find((entry) => entry.id === item.id);
                                    if (purchaseItem) {
                                      openEditPurchaseItemModal(purchaseItem);
                                    }
                                  }}
                                  title="Editar"
                                  aria-label={`Editar item de compra ${item.name}`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                    edit
                                  </span>
                                </button>
                                <button
                                  className="btn-icon btn-icon--danger"
                                  type="button"
                                  onClick={() => deletePurchaseItem(item.id)}
                                  title="Remover"
                                  aria-label={`Remover item de compra ${item.name}`}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                    delete
                                  </span>
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {combinedPurchaseItems.length === 0 ? (
                  <div className="card" style={{ padding: 18, color: "var(--muted)" }}>
                    Nenhum item de compra cadastrado ainda.
                  </div>
                ) : null}

                {purchaseMessage ? <p className="subtitle" style={{ margin: 0 }}>{purchaseMessage}</p> : null}
              </div>
            </section>
          </div>
        </div>
      </AdminLayout>

      {purchaseCategoryModalOpen ? (
        <Modal
          title={purchaseCategoryEditingId ? "Editar categoria de compra" : "Adicionar categoria de compra"}
          onClose={closePurchaseCategoryModal}
        >
          <form onSubmit={savePurchaseCategory} className="grid" style={{ gap: 12 }}>
            <input
              className="input"
              value={purchaseCategoryName}
              onChange={(event) => setPurchaseCategoryName(event.target.value)}
              placeholder="Nome da categoria"
            />
            <button className="btn btn-primary" type="submit">
              {purchaseCategoryEditingId ? "Salvar alterações" : "Salvar categoria"}
            </button>
            {purchaseCategoryMessage ? <p style={{ margin: 0 }}>{purchaseCategoryMessage}</p> : null}
          </form>
        </Modal>
      ) : null}

      {modalMode === "category" ? (
        <Modal
          title={categoryEditingId ? "Editar Categoria" : "Adicionar Categoria"}
          onClose={closeModal}
        >
          <form onSubmit={saveCategory} className="grid" style={{ gap: 12 }}>
            <input
              className="input"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Nome da categoria"
            />
            <button className="btn btn-primary" type="submit">
              {categoryEditingId ? "Salvar alterações" : "Salvar categoria"}
            </button>
            {categoryMessage ? <p style={{ margin: 0 }}>{categoryMessage}</p> : null}
          </form>
        </Modal>
      ) : null}

      {modalMode === "product" || modalMode === "edit" ? (
        <Modal
          title={modalMode === "edit" ? "Editar produto" : "Adicionar produto"}
          onClose={closeModal}
        >
          <form
            onSubmit={modalMode === "edit" ? updateProduct : createProduct}
            className="grid"
            style={{ gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <CldUploadWidget
                signatureEndpoint="/api/cloudinary/signature"
                onSuccess={(result) => {
                  const info = result.info;
                  if (info && typeof info === "object" && "secure_url" in info) {
                    setImagePath(String(info.secure_url));
                  }
                }}
                options={{
                  sources: ["local"],
                  multiple: false,
                  maxFiles: 1,
                }}
              >
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      border: "2px dashed var(--line)",
                      overflow: "hidden",
                      background: "var(--surface-2)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      margin: "0 auto",
                      padding: 0,
                    }}
                  >
                    {imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePath}
                        alt="Pré-visualização do produto"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span className="muted" style={{ textAlign: "center", padding: 12 }}>
                        Adicionar imagem
                      </span>
                    )}
                  </button>
                )}
              </CldUploadWidget>
            </div>

            <label className="public-form-field">
              <span className="public-form-label">Produto</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do item"
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Marca</span>
              <input
                className="input"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Ex: Heinz, Ypê, Maratá..."
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Preço de venda</span>
              <input
                className="input"
                value={price}
                onChange={(event) => setPrice(normalizePriceInput(event.target.value))}
                placeholder="Ex: 7,50"
                inputMode="decimal"
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Preço de custo</span>
              <input
                className="input"
                value={cost}
                onChange={(event) => setCost(normalizePriceInput(event.target.value))}
                placeholder="Ex: 4,50"
                inputMode="decimal"
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Quantidade em estoque</span>
              <input
                className="input"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Ex: 24"
                inputMode="numeric"
              />
            </label>
            <div className="modal-choice-field">
              <div className="public-form-label">Estoque</div>
              <div className="modal-choice-strip">
                <button
                  type="button"
                  className={`modal-choice-chip${stockStatus === "active" ? " is-active" : ""}`}
                  onClick={() => setStockStatus("active")}
                  aria-pressed={stockStatus === "active"}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    inventory_2
                  </span>
                  <span>Com estoque</span>
                </button>
                <button
                  type="button"
                  className={`modal-choice-chip${stockStatus === "inactive" ? " is-active" : ""}`}
                  onClick={() => setStockStatus("inactive")}
                  aria-pressed={stockStatus === "inactive"}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    block
                  </span>
                  <span>Sem estoque</span>
                </button>
              </div>
            </div>

            <div className="modal-choice-field">
              <div className="public-form-label">Categoria</div>
              <div className="modal-choice-strip modal-choice-strip--wrap">
                {categories.length > 0 ? (
                  categories.map((category) => {
                    const active = categoryId === String(category.id);

                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`modal-choice-chip${active ? " is-active" : ""}`}
                        onClick={() => setCategoryId(String(category.id))}
                        aria-pressed={active}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {getCategoryIcon(category.name)}
                        </span>
                        <span>{category.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="muted" style={{ padding: "10px 2px" }}>
                    Nenhuma categoria cadastrada.
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              {modalMode === "edit" ? "Salvar alterações" : "Salvar item"}
            </button>
            {message ? <p style={{ margin: 0 }}>{message}</p> : null}
          </form>
        </Modal>
      ) : null}

      {purchaseModalMode === "product" || purchaseModalMode === "edit" ? (
        <Modal
          title={purchaseModalMode === "edit" ? "Editar item de compra" : "Adicionar item de compra"}
          onClose={closePurchaseModal}
        >
          <form
            onSubmit={purchaseModalMode === "edit" ? updatePurchaseItem : createPurchaseItem}
            className="grid"
            style={{ gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <CldUploadWidget
                signatureEndpoint="/api/cloudinary/signature"
                onSuccess={(result) => {
                  const info = result.info;
                  if (info && typeof info === "object" && "secure_url" in info) {
                    setPurchaseImagePath(String(info.secure_url));
                  }
                }}
                options={{
                  sources: ["local"],
                  multiple: false,
                  maxFiles: 1,
                }}
              >
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    style={{
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      border: "2px dashed var(--line)",
                      overflow: "hidden",
                      background: "var(--surface-2)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      margin: "0 auto",
                      padding: 0,
                    }}
                  >
                    {purchaseImagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={purchaseImagePath}
                        alt="Pré-visualização do item de compra"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span className="muted" style={{ textAlign: "center", padding: 12 }}>
                        Adicionar imagem
                      </span>
                    )}
                  </button>
                )}
              </CldUploadWidget>
            </div>

            <label className="public-form-field">
              <span className="public-form-label">Item</span>
              <input
                className="input"
                value={purchaseName}
                onChange={(event) => setPurchaseName(event.target.value)}
                placeholder="Nome do item"
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Marca</span>
              <input
                className="input"
                value={purchaseBrand}
                onChange={(event) => setPurchaseBrand(event.target.value)}
                placeholder="Ex: Heinz, Ypê, Maratá..."
              />
            </label>
            <label className="public-form-field">
              <span className="public-form-label">Custo</span>
              <input
                className="input"
                value={purchaseCost}
                onChange={(event) => setPurchaseCost(normalizePriceInput(event.target.value))}
                placeholder="Ex: 4,50"
                inputMode="decimal"
              />
            </label>

            <div className="modal-choice-field">
              <div className="public-form-label">Categorias</div>
              <div className="modal-choice-strip modal-choice-strip--wrap">
                {combinedPurchaseCategories.length > 0 ? (
                  combinedPurchaseCategories.map((category) => {
                    const active = purchaseCategoryId === category.name;

                    return (
                      <button
                        key={category.name}
                        type="button"
                        className={`modal-choice-chip${active ? " is-active" : ""}`}
                        onClick={() => setPurchaseCategoryId(category.name)}
                        aria-pressed={active}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          category
                        </span>
                        <span>{category.name}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="muted" style={{ padding: "10px 2px" }}>
                    Nenhuma categoria cadastrada.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-choice-field">
              <div className="public-form-label">Status</div>
              <div className="modal-choice-strip">
                <button
                  type="button"
                  className={`modal-choice-chip${purchaseActive ? " is-active" : ""}`}
                  onClick={() => setPurchaseActive(true)}
                  aria-pressed={purchaseActive}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                  <span>Ativo</span>
                </button>
                <button
                  type="button"
                  className={`modal-choice-chip${!purchaseActive ? " is-active" : ""}`}
                  onClick={() => setPurchaseActive(false)}
                  aria-pressed={!purchaseActive}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    block
                  </span>
                  <span>Inativo</span>
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              {purchaseModalMode === "edit" ? "Salvar alterações" : "Salvar item"}
            </button>
            {purchaseMessage ? <p style={{ margin: 0 }}>{purchaseMessage}</p> : null}
          </form>
        </Modal>
      ) : null}
    </>
  );
}




