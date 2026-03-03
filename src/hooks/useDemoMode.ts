import { useParams } from "react-router-dom";

export function useDemoMode() {
  const { slug } = useParams<{ slug: string }>();
  const isDemo = slug === "demo";
  return { isDemo };
}
