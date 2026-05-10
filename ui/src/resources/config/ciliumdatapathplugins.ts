import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumDatapathPluginsConfig: ResourceConfig = shared.ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumdatapathplugins", path: "/networks/cilium/datapath-plugins", title: "Cilium Datapath Plugins", subtitle: "Manage Cilium datapath plugin resources", kind: "CiliumDatapathPlugin", buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] });
