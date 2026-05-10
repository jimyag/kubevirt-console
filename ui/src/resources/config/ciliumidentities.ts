import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumIdentitiesConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumidentities", path: "/networks/cilium/identities", title: "Cilium Identities", subtitle: "Inspect CiliumIdentity resources", kind: "CiliumIdentity", allowCreate: false, allowDelete: false, statusPath: ["security-labels", "0"] });
