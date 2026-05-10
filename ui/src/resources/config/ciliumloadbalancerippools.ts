import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumLoadBalancerIPPoolsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumloadbalancerippools", path: "/networks/cilium/load-balancer-ip-pools", title: "Cilium Load Balancer IP Pools", subtitle: "Manage Cilium LoadBalancer IP pools", kind: "CiliumLoadBalancerIPPool", createFields: [{ name: "cidr", label: "CIDR", section: "Pool", defaultValue: "192.0.2.0/24" }, { name: "disabled", label: "Disabled", section: "Pool", type: "checkbox", defaultValue: false }], buildSpec: (values) => ({ blocks: [{ cidr: shared.stringValue(values.cidr, "192.0.2.0/24") }], disabled: values.disabled === true }), statusPath: ["status", "conditions", "0", "type"] });
