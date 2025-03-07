import { useAsync, ref } from "@nuxtjs/composition-api";
import { useAsyncKey } from "../use-utils";
import { useUserApi } from "~/composables/api";
import { Recipe } from "~/lib/api/types/recipe";
import { RecipeSearchQuery } from "~/lib/api/user/recipes/recipe";

export const allRecipes = ref<Recipe[]>([]);
export const recentRecipes = ref<Recipe[]>([]);

export const useLazyRecipes = function () {
  const api = useUserApi();

  const recipes = ref<Recipe[]>([]);

  async function fetchMore(
    page: number,
    perPage: number,
    orderBy: string | null = null,
    orderDirection = "desc",
    query: RecipeSearchQuery | null = null,
    queryFilter: string | null = null,
  ) {
    const { data } = await api.recipes.getAll(page, perPage, {
      orderBy,
      orderDirection,
      paginationSeed: query?._searchSeed, // propagate searchSeed to stabilize random order pagination
      searchSeed: query?._searchSeed, // unused, but pass it along for completeness of data
      search: query?.search,
      cookbook: query?.cookbook,
      categories: query?.categories,
      requireAllCategories: query?.requireAllCategories,
      tags: query?.tags,
      requireAllTags: query?.requireAllTags,
      tools: query?.tools,
      requireAllTools: query?.requireAllTools,
      foods: query?.foods,
      requireAllFoods: query?.requireAllFoods,
      queryFilter,
    });
    return data ? data.items : [];
  }

  function appendRecipes(val: Array<Recipe>) {
    val.forEach((recipe) => {
      recipes.value.push(recipe);
    });
  }

  function assignSorted(val: Array<Recipe>) {
    recipes.value = val;
  }

  function removeRecipe(slug: string) {
    for (let i = 0; i < recipes?.value?.length; i++) {
      if (recipes?.value[i].slug === slug) {
        recipes?.value.splice(i, 1);
        break;
      }
    }
  }

  function replaceRecipes(val: Array<Recipe>) {
    recipes.value = val;
  }

  return {
    recipes,
    fetchMore,
    appendRecipes,
    assignSorted,
    removeRecipe,
    replaceRecipes,
  };
};

export const useRecipes = (all = false, fetchRecipes = true, loadFood = false) => {
  const api = useUserApi();

  // recipes is non-reactive!!
  const { recipes, page, perPage } = (() => {
    if (all) {
      return {
        recipes: allRecipes,
        page: 1,
        perPage: -1,
      };
    } else {
      return {
        recipes: recentRecipes,
        page: 1,
        perPage: 30,
      };
    }
  })();

  async function refreshRecipes() {
    const { data } = await api.recipes.getAll(page, perPage, { loadFood, orderBy: "created_at" });
    if (data) {
      recipes.value = data.items;
    }
  }

  function getAllRecipes() {
    useAsync(async () => {
      await refreshRecipes();
    }, useAsyncKey());
  }

  function assignSorted(val: Array<Recipe>) {
    recipes.value = val;
  }

  if (fetchRecipes) {
    getAllRecipes();
  }

  return { getAllRecipes, assignSorted, refreshRecipes };
};
