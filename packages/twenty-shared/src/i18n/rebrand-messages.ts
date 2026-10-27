import { type Messages } from '@lingui/core';

import { UPSTREAM_PRODUCT_NAME } from '@/constants/UpstreamProductName';

const UPSTREAM_PRODUCT_NAME_PATTERN = new RegExp(
  `\\b${UPSTREAM_PRODUCT_NAME}\\b`,
  'g',
);

const rebrandCompiledMessage = (
  message: unknown,
  productName: string,
): unknown => {
  if (typeof message === 'string') {
    return message.replace(UPSTREAM_PRODUCT_NAME_PATTERN, productName);
  }

  if (Array.isArray(message)) {
    return message.map((token) => rebrandCompiledMessage(token, productName));
  }

  if (typeof message === 'object' && message !== null) {
    return Object.fromEntries(
      Object.entries(message).map(([key, value]) => [
        key,
        rebrandCompiledMessage(value, productName),
      ]),
    );
  }

  return message;
};

// Catalogs keep the upstream product name so they can be synced from upstream
// untouched; swapping it at load time rebrands every locale at once.
export const rebrandMessages = (
  messages: Messages,
  productName: string,
): Messages => {
  if (productName === UPSTREAM_PRODUCT_NAME) {
    return messages;
  }

  return rebrandCompiledMessage(messages, productName) as Messages;
};
