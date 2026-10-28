import logo from "tenant-brand";
import { MicOrb } from "@/components/duet/mic-orb";
import { appConfig } from "@/lib/generated/application-config";

/** The product's logo where the app introduces itself, or the Bot's orb when the tenant has none. */
export function BrandMark({ size }: { size: number }) {
  return logo ? (
    <img
      alt={appConfig.brand.productName}
      height={size}
      src={logo}
      width={size}
    />
  ) : (
    <MicOrb size={size} />
  );
}
