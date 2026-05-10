import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoIPAMHandlesConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "ipamhandles", path: "/networks/calico/ipam-handles", title: "Calico IPAM Handles", subtitle: "Inspect Calico IPAMHandle resources", kind: "IPAMHandle", allowCreate: false, allowDelete: false });
