import { configureStore } from "@reduxjs/toolkit";
import imageGenerationsReducer from "./slices/imageGenerationsSlice";
import videoGenerationsReducer from "./slices/videoGenerationsSlice";

export const store = configureStore({
  reducer: {
    imageGenerations: imageGenerationsReducer,
    videoGenerations: videoGenerationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

