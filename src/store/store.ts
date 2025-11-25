import { configureStore } from "@reduxjs/toolkit";
import imageGenerationsReducer from "./slices/imageGenerationsSlice";
import keyMappingsReducer from "./slices/keyMappingsSlice";

export const store = configureStore({
  reducer: {
    imageGenerations: imageGenerationsReducer,
    keyMappings: keyMappingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

