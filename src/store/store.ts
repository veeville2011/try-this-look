import { configureStore } from "@reduxjs/toolkit";
import imageGenerationsReducer from "./slices/imageGenerationsSlice";
import keyMappingsReducer from "./slices/keyMappingsSlice";
import storeInfoReducer from "./slices/storeInfoSlice";
import productsReducer from "./slices/productsSlice";

export const store = configureStore({
  reducer: {
    imageGenerations: imageGenerationsReducer,
    keyMappings: keyMappingsReducer,
    storeInfo: storeInfoReducer,
    products: productsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

