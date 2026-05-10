import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoIPAMBlocksConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "ipamblocks", path: "/networks/calico/ipam-blocks", title: "Calico IPAM Blocks", subtitle: "Inspect Calico IPAMBlock resources", kind: "IPAMBlock", allowCreate: false, allowDelete: false, statusPath: ["spec", "cidr"] });
