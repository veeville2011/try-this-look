/**
 * Feature Highlights Component
 * Displays key features of the app in a grid layout
 */

import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Zap, Smartphone, TrendingUp } from "lucide-react";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    title: "Essayage virtuel alimenté par IA",
    description: "Technologie IA avancée pour des expériences d'essayage virtuel réalistes",
  },
  {
    icon: <Zap className="w-8 h-8 text-primary" />,
    title: "Intégration facile",
    description: "Installez en quelques minutes avec notre processus de configuration simple",
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-primary" />,
    title: "Augmentez les ventes",
    description: "Augmentez les conversions en aidant les clients à visualiser les produits",
  },
  {
    icon: <Smartphone className="w-8 h-8 text-primary" />,
    title: "Compatible mobile",
    description: "Fonctionne parfaitement sur tous les appareils et tailles d'écran",
  },
];

const FeatureHighlights = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {features.map((feature, index) => (
        <Card
          key={index}
          className="border-2 border-border hover:border-primary/50 transition-colors"
        >
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">{feature.icon}</div>
            <h3 className="font-semibold text-lg mb-2 text-foreground">
              {feature.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {feature.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FeatureHighlights;

