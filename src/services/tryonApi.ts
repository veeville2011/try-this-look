import { TryOnResponse } from "@/types/tryon";

const API_ENDPOINT = "https://try-on-server-v1.onrender.com/api/fashion-photo";
const HEALTH_ENDPOINT = "https://try-on-server-v1.onrender.com/api/health";

export async function generateTryOn(
  personImage: File | Blob,
  clothingImage: Blob,
  storeName?: string | null,
  clothingKey?: string | null,
  personKey?: string | null
): Promise<TryOnResponse> {
  try {
    const formData = new FormData();
    formData.append("personImage", personImage);
    formData.append("clothingImage", clothingImage, "clothing-item.jpg");

    if (storeName) {
      formData.append("storeName", storeName);
    }

    if (clothingKey) {
      formData.append("clothingKey", clothingKey);
    }

    if (personKey) {
      formData.append("personKey", personKey);
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Content-Language": "fr",
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      status: "error",
      error_message: {
        code: "NETWORK_ERROR",
        message: "Une erreur de connexion s'est produite.",
      },
    };
  }
}

export const getHealthStatus = async (): Promise<void> => {
  try {
    const response = await fetch(HEALTH_ENDPOINT, {
      headers: {
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      return;
    }

    await response.json();
  } catch (error) {
    // Health check request failed
  }
};

export async function fetchImageWithCorsHandling(
  url: string,
  signal?: AbortSignal
): Promise<Blob> {
  const strategies = [
    async () => {
      const response = await fetch(url, {
        mode: "cors",
        signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.blob();
    },
    async () => {
      const response = await fetch(url, {
        mode: "no-cors",
        signal,
      });
      if (response.type === "opaque") {
        throw new Error("Réponse no-cors reçue");
      }
      return response.blob();
    },
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      return await strategies[i]();
    } catch (error) {
      if (i === strategies.length - 1) throw error;
    }
  }

  throw new Error("Toutes les stratégies CORS ont échoué");
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const response = await fetch(dataURL);
  return response.blob();
}
