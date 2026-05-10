import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumBGPPeerConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumbgppeerconfigs", path: "/networks/cilium/bgp-peer-configs", title: "Cilium BGP Peer Configs", subtitle: "Manage Cilium BGPPeerConfig resources", kind: "CiliumBGPPeerConfig", createFields: [{ name: "peerASN", label: "Peer ASN", section: "BGP", type: "number", defaultValue: "64512" }], buildSpec: (values) => ({ families: [], timers: {}, authSecretRef: "", gracefulRestart: {}, transport: {}, ebgpMultihop: 1, peerASN: shared.numberValue(values.peerASN, 64512) }), statusPath: ["status", "conditions", "0", "type"] });
