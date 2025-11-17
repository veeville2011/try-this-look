import { configureStore } from "@reduxjs/toolkit";
import imageGenerationsReducer from "./slices/imageGenerationsSlice";

export const store = configureStore({
  reducer: {
    imageGenerations: imageGenerationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

