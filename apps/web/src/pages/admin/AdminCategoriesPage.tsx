import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategoryBodySchema, createSubcategoryBodySchema } from '@qc/shared';
import type { AdminCategory } from '@qc/shared';
import { ApiError } from '../../api/client.js';
import { fieldErrors } from '../../auth/messages.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { formText } from '../../catalog/form.js';
import { imageHosts } from '../../catalog/image.js';
import { CATALOG_STALE_TIME_MS } from '../../catalog/stale.js';
import { ConfirmDialog } from '../../components/catalog/ConfirmDialog.js';

interface DeleteTarget {
  kind: 'category' | 'subcategory';
  id: string;
  name: string;
}

export function AdminCategoriesPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['categories', 'admin'],
    queryFn: () => api.listAdminCategories(true),
    staleTime: CATALOG_STALE_TIME_MS,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    await queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = createCategoryBodySchema(imageHosts()).safeParse({
      name,
      description: description.trim() === '' ? null : description,
      imageUrl: imageUrl.trim() === '' ? null : imageUrl,
      sortOrder: Number(sortOrder),
      isActive,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api.createCategory(parsed.data);
      setName('');
      setDescription('');
      setImageUrl('');
      setFormError(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof ApiError ? error.message : 'Could not save the category');
    } finally {
      setPending(false);
    }
  }

  async function onSaveCategory(
    category: AdminCategory,
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = createCategoryBodySchema(imageHosts()).safeParse({
      name: formText(form, 'name'),
      description: formText(form, 'description'),
      imageUrl: formText(form, 'imageUrl'),
      sortOrder: Number(formText(form, 'sortOrder') || '0'),
      isActive: form.get('isActive') === 'on',
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the category');
      return;
    }
    setPending(true);
    try {
      await api.updateCategory(category.id, {
        ...parsed.data,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
      });
      setEditingId(null);
      setFormError(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof ApiError ? error.message : 'Could not update the category');
    } finally {
      setPending(false);
    }
  }

  async function onCreateSub(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = createSubcategoryBodySchema().safeParse({ name: subName, isActive: true });
    if (!parsed.success || subParent === '') {
      setFormError(
        parsed.success
          ? 'Choose a category'
          : (parsed.error.issues[0]?.message ?? 'Check the name'),
      );
      return;
    }
    setPending(true);
    try {
      await api.createSubcategory(subParent, parsed.data);
      setSubName('');
      setFormError(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof ApiError ? error.message : 'Could not add the subcategory');
    } finally {
      setPending(false);
    }
  }

  async function onMove(id: string, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await api.updateSubcategory(id, {
        name: formText(form, 'name'),
        categoryId: formText(form, 'categoryId'),
        sortOrder: Number(formText(form, 'sortOrder') || '0'),
        isActive: form.get('isActive') === 'on',
      });
      setFormError(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof ApiError ? error.message : 'Could not update the subcategory');
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'category') {
        await api.deleteCategory(deleteTarget.id);
      } else {
        await api.deleteSubcategory(deleteTarget.id);
      }
      setDeleteTarget(null);
      setFormError(null);
      await refresh();
    } catch (error: unknown) {
      setFormError(error instanceof ApiError ? error.message : 'Could not delete');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">Categories</h1>
      {formError ? (
        <p role="alert" className="text-red-800">
          {formError}
        </p>
      ) : null}
      <form
        onSubmit={(event) => void onCreate(event)}
        className="flex flex-col gap-3 rounded border border-stone-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold">New category</h2>
        <label htmlFor="category-name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="category-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          aria-invalid={errors.name ? true : undefined}
          className="rounded border border-stone-400 px-3 py-2"
        />
        {errors.name ? <p className="text-sm text-red-800">{errors.name}</p> : null}
        <label htmlFor="category-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="category-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          className="rounded border border-stone-400 px-3 py-2"
        />
        <label htmlFor="category-image" className="text-sm font-medium">
          Image URL
        </label>
        <input
          id="category-image"
          value={imageUrl}
          onChange={(event) => {
            setImageUrl(event.target.value);
          }}
          aria-invalid={errors.imageUrl ? true : undefined}
          className="rounded border border-stone-400 px-3 py-2"
        />
        {errors.imageUrl ? <p className="text-sm text-red-800">{errors.imageUrl}</p> : null}
        <label htmlFor="category-sort" className="text-sm font-medium">
          Sort order
        </label>
        <input
          id="category-sort"
          inputMode="numeric"
          value={sortOrder}
          onChange={(event) => {
            setSortOrder(event.target.value);
          }}
          className="rounded border border-stone-400 px-3 py-2"
        />
        <label htmlFor="category-active" className="flex items-center gap-2 text-sm">
          <input
            id="category-active"
            type="checkbox"
            checked={isActive}
            onChange={(event) => {
              setIsActive(event.target.checked);
            }}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded bg-stone-900 px-4 py-2 text-white"
        >
          Add category
        </button>
      </form>

      {categories.isLoading ? <p role="status">Loading categories</p> : null}
      {categories.isError ? (
        <p role="alert" className="text-red-800">
          Categories could not be loaded.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {categories.data?.map((category) => (
          <li key={category.id} className="rounded border border-stone-200 bg-white p-4">
            <h2 className="text-xl font-semibold">{category.name}</h2>
            <p className="text-sm text-stone-700">
              {category.isActive ? 'Active' : 'Inactive'} · {category.subcategoryCount}{' '}
              subcategories · {category.productCount} products
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={() => {
                  setEditingId(editingId === category.id ? null : category.id);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="underline-offset-4 hover:underline"
                onClick={() => {
                  setDeleteTarget({ kind: 'category', id: category.id, name: category.name });
                }}
              >
                Delete
              </button>
            </div>
            {editingId === category.id ? (
              <form
                onSubmit={(event) => void onSaveCategory(category, event)}
                className="mt-4 flex flex-col gap-2"
              >
                <label htmlFor={`edit-name-${category.id}`} className="text-sm font-medium">
                  Name
                </label>
                <input
                  id={`edit-name-${category.id}`}
                  name="name"
                  defaultValue={category.name}
                  className="rounded border border-stone-400 px-3 py-2"
                />
                <label htmlFor={`edit-description-${category.id}`} className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id={`edit-description-${category.id}`}
                  name="description"
                  defaultValue={category.description ?? ''}
                  className="rounded border border-stone-400 px-3 py-2"
                />
                <label htmlFor={`edit-image-${category.id}`} className="text-sm font-medium">
                  Image URL
                </label>
                <input
                  id={`edit-image-${category.id}`}
                  name="imageUrl"
                  defaultValue={category.imageUrl ?? ''}
                  className="rounded border border-stone-400 px-3 py-2"
                />
                <label htmlFor={`edit-sort-${category.id}`} className="text-sm font-medium">
                  Sort order
                </label>
                <input
                  id={`edit-sort-${category.id}`}
                  name="sortOrder"
                  defaultValue={String(category.sortOrder)}
                  className="rounded border border-stone-400 px-3 py-2"
                />
                <label
                  htmlFor={`edit-active-${category.id}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    id={`edit-active-${category.id}`}
                    name="isActive"
                    type="checkbox"
                    defaultChecked={category.isActive}
                  />
                  Active
                </label>
                <button type="submit" className="w-fit rounded bg-stone-900 px-3 py-2 text-white">
                  Save category
                </button>
              </form>
            ) : null}
            <ul className="mt-4 flex flex-col gap-3">
              {category.subcategories.map((subcategory) => (
                <li key={subcategory.id} className="rounded bg-stone-50 p-3">
                  <h3 className="font-medium">{subcategory.name}</h3>
                  <form
                    onSubmit={(event) => void onMove(subcategory.id, event)}
                    className="mt-2 flex flex-col gap-2"
                  >
                    <label htmlFor={`sub-name-${subcategory.id}`} className="text-sm font-medium">
                      Name
                    </label>
                    <input
                      id={`sub-name-${subcategory.id}`}
                      name="name"
                      defaultValue={subcategory.name}
                      className="rounded border border-stone-400 px-3 py-2"
                    />
                    <label htmlFor={`sub-cat-${subcategory.id}`} className="text-sm font-medium">
                      Category
                    </label>
                    <select
                      id={`sub-cat-${subcategory.id}`}
                      name="categoryId"
                      defaultValue={subcategory.categoryId}
                      className="rounded border border-stone-400 bg-white px-3 py-2"
                    >
                      {categories.data.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <label htmlFor={`sub-sort-${subcategory.id}`} className="text-sm font-medium">
                      Sort order
                    </label>
                    <input
                      id={`sub-sort-${subcategory.id}`}
                      name="sortOrder"
                      defaultValue={String(subcategory.sortOrder)}
                      className="rounded border border-stone-400 px-3 py-2"
                    />
                    <label
                      htmlFor={`sub-active-${subcategory.id}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        id={`sub-active-${subcategory.id}`}
                        name="isActive"
                        type="checkbox"
                        defaultChecked={subcategory.isActive}
                      />
                      Active
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="rounded bg-stone-900 px-3 py-2 text-sm text-white"
                      >
                        Save subcategory
                      </button>
                      <button
                        type="button"
                        className="text-sm underline-offset-4 hover:underline"
                        onClick={() => {
                          setDeleteTarget({
                            kind: 'subcategory',
                            id: subcategory.id,
                            name: subcategory.name,
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => void onCreateSub(event)}
        className="flex flex-col gap-3 rounded border border-stone-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold">New subcategory</h2>
        <label htmlFor="sub-parent" className="text-sm font-medium">
          Category
        </label>
        <select
          id="sub-parent"
          value={subParent}
          onChange={(event) => {
            setSubParent(event.target.value);
          }}
          className="rounded border border-stone-400 bg-white px-3 py-2"
        >
          <option value="">Choose a category</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <label htmlFor="sub-name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="sub-name"
          value={subName}
          onChange={(event) => {
            setSubName(event.target.value);
          }}
          className="rounded border border-stone-400 px-3 py-2"
        />
        <button type="submit" className="w-fit rounded bg-stone-900 px-4 py-2 text-white">
          Add subcategory
        </button>
      </form>

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message="This removes it from the store. A category or subcategory that still has children stays in place."
          confirmLabel="Delete"
          pending={deleting}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </div>
  );
}
