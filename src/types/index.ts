export interface School {
  id: string;
  name: string;
  code: string;
  type: "main" | "branch" | "warehouse";
  address?: string;
  phone?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "central_admin" | "warehouse_admin" | "school_admin" | "branch_admin";
  schoolId?: string | null;
  createdAt: string;
  updatedAt: string;
  school?: School | null;
}

export interface Book {
  id: string;
  isbn: string;
  title: string;
  publicTitle?: string | null;
  supplierIds?: string[];
  author: string;
  publisher: string;
  publishYear?: number;
  category?: string;
  description?: string;
  coverUrl?: string;
  price?: number;
  buyPrice?: number;
  sellPrice?: number;
}


