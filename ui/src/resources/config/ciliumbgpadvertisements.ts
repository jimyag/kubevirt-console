import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumBGPAdvertisementsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumbgpadvertisements", path: "/networks/cilium/bgp-advertisements", title: "Cilium BGP Advertisements", subtitle: "Manage Cilium BGPAdvertisement resources", kind: "CiliumBGPAdvertisement", buildSpec: () => ({ advertisements: [] }), statusPath: ["status", "conditions", "0", "type"] });
