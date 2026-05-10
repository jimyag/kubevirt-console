import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnIPsConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ips",
    path: "/networks/kube-ovn/ips",
    title: "Kube-OVN IPs",
    subtitle: "Inspect Kube-OVN allocated IP resources",
    kind: "IP",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["spec", "subnet"],
    extraColumns: [
      { label: "Subnet", value: (r) => String(shared.getRecord(r.spec).subnet || "N/A") },
      { label: "V4 IP", value: (r) => String(shared.getRecord(r.spec).v4IPAddress || shared.getRecord(r.spec).ipAddress || "N/A") },
    ],
  });
