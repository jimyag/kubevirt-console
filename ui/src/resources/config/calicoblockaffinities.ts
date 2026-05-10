import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoBlockAffinitiesConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "blockaffinities", path: "/networks/calico/block-affinities", title: "Calico Block Affinities", subtitle: "Inspect Calico IPAM block affinity resources", kind: "BlockAffinity", allowCreate: false, allowDelete: false, statusPath: ["spec", "state"] });
