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
    title: "AI-Powered Virtual Try-On",
    description: "Advanced AI technology for realistic virtual try-on experiences",
  },
  {
    icon: <Zap className="w-8 h-8 text-primary" />,
    title: "Easy Integration",
    description: "Install in minutes with our simple setup process",
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-primary" />,
    title: "Boost Sales",
    description: "Increase conversions by helping customers visualize products",
  },
  {
    icon: <Smartphone className="w-8 h-8 text-primary" />,
    title: "Mobile-Friendly",
    description: "Works seamlessly on all devices and screen sizes",
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

