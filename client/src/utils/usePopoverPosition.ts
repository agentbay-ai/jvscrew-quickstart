import { useLayoutEffect, useState, type RefObject } from 'react';

export interface PopoverPos {
  left: number;
  bottom: number;
  width: number;
}

/**
 * 把 popover 锚定到 trigger 元素的上方（用 fixed 定位）。
 * 需要这么做是因为 trigger 所在容器（如 ChatArea）有 overflow-hidden，
 * 普通 absolute 定位会被裁切。配合 createPortal 渲染到 body 上即可避开。
 */
export function usePopoverPosition(anchorRef: RefObject<HTMLElement | null>): PopoverPos | null {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setPos({
        left: r.left,
        bottom: window.innerHeight - r.top + 8,
        width: r.width,
      });
    };
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef]);

  return pos;
}
