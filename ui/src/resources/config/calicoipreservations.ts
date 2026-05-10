import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoIPReservationsConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "ipreservations", path: "/networks/calico/ip-reservations", title: "Calico IP Reservations", subtitle: "Manage Calico IPReservation resources", kind: "IPReservation", createFields: [{ name: "reservedCIDRs", label: "Reserved CIDRs", section: "Reservation", defaultValue: "10.244.0.10/32", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ reservedCIDRs: shared.csvList(values.reservedCIDRs) }), statusPath: ["spec", "reservedCIDRs", "0"] });
