// Fixed IDs for demo pictures - these will be sent as personKey to the fashion API
const DEMO_PHOTOS = [
  { url: "/assets/demo_pics/p1.jpg", id: "new_demo_person_1" },
  { url: "/assets/demo_pics/p2.jpg", id: "new_demo_person_2" },
  { url: "/assets/demo_pics/p3.jpg", id: "new_demo_person_3" },
  { url: "/assets/demo_pics/p4.jpg", id: "new_demo_person_4" },
  { url: "/assets/demo_pics/p1.jpg", id: "new_demo_person_5" },
  { url: "/assets/demo_pics/p2.jpg", id: "new_demo_person_6" },
  { url: "/assets/demo_pics/p3.jpg", id: "new_demo_person_7" },
  { url: "/assets/demo_pics/p4.jpg", id: "new_demo_person_8" },
  { url: "/assets/demo_pics/p1.jpg", id: "new_demo_person_9" },
  { url: "/assets/demo_pics/p2.jpg", id: "new_demo_person_10" },
  { url: "/assets/demo_pics/p3.jpg", id: "new_demo_person_11" },
  { url: "/assets/demo_pics/p4.jpg", id: "new_demo_person_12" },
] as const;

// Map demo photo URLs to their fixed IDs
export const DEMO_PHOTO_ID_MAP = new Map<string, string>(
  DEMO_PHOTOS.map((photo) => [photo.url, photo.id])
);

// Export DEMO_PHOTOS array for use in components
export const DEMO_PHOTOS_ARRAY = DEMO_PHOTOS;

