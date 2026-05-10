import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoBGPFiltersConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "bgpfilters", path: "/networks/calico/bgp-filters", title: "Calico BGP Filters", subtitle: "Manage Calico BGPFilter resources", kind: "BGPFilter", buildSpec: () => ({}) });
