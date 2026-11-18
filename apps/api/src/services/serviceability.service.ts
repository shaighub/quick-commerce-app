import type { ServiceabilityResponse } from '@qc/shared';
import { isPincodeServiceable } from '@qc/shared';

export interface ServiceabilityService {
  check(pincode: string): ServiceabilityResponse;
}

export function createServiceabilityService(deps: {
  pincodes: readonly string[];
  deliveryFeePaise: number;
}): ServiceabilityService {
  return {
    check(pincode: string): ServiceabilityResponse {
      return {
        pincode,
        serviceable: isPincodeServiceable(pincode, deps.pincodes),
        deliveryFeePaise: deps.deliveryFeePaise,
      };
    },
  };
}
