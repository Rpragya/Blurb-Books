/**
 * Motion primitives. Everything here is decoration on top of content that is
 * already readable: nothing waits for an animation to become usable, and
 * <MotionConfig reducedMotion="user"> (main.tsx) plus the checks below turn
 * movement off for readers who ask for less motion.
 */
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';
import { useRef, type ReactNode } from 'react';

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 1, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT_EXPO } },
};

/** Content is readable immediately; scrolling adds a gentle settling motion. */
export function Reveal({
  children,
  delay = 0,
  as = 'div',
  className,
  ...rest
}: { children: ReactNode; delay?: number; as?: 'div' | 'section' | 'li' | 'header'; className?: string } & Omit<
  HTMLMotionProps<'div'>,
  'children'
>) {
  const Component = motion[as] as typeof motion.div;
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={revealVariants}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </Component>
  );
}

/** Parent for staggered children: wrap each child in <StaggerItem>. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  as = 'div',
  ...rest
}: { children: ReactNode; className?: string; stagger?: number; as?: 'div' | 'ul' | 'ol' } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const Component = motion[as] as typeof motion.div;
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({ children, className, as = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'li' } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const Component = motion[as] as typeof motion.div;
  return (
    <Component className={className} variants={revealVariants} {...rest}>
      {children}
    </Component>
  );
}

/**
 * Moves its child vertically as the element crosses the viewport.
 * `strength` is the total travel in px (half up, half down).
 */
export function Parallax({ children, strength = 80, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-strength / 2, strength / 2]);
  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden' }}>
      <motion.div style={{ y, height: '100%' }}>{children}</motion.div>
    </div>
  );
}

/**
 * Headline that rises in word by word on first render. Screen readers get
 * the plain sentence once; the animated words are hidden from them.
 * Words listed in `emphasis` render as the italic serif accent; `breakAfter`
 * forces a line break after that word index.
 */
export function SplitWords({
  text,
  emphasis = [],
  breakAfter,
  delay = 0,
}: {
  text: string;
  emphasis?: string[];
  breakAfter?: number;
  delay?: number;
}) {
  const words = text.split(' ');
  return (
    <>
      <span className="visually-hidden">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => {
          const inner = (
            <motion.span
              className="split-word__inner"
              initial={{ y: '105%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: delay + i * 0.08 }}
            >
              {word}
            </motion.span>
          );
          return (
            <span key={i}>
              <span className="split-word">{emphasis.includes(word) ? <em>{inner}</em> : inner}</span>
              {i === breakAfter ? <br /> : i < words.length - 1 && ' '}
            </span>
          );
        })}
      </span>
    </>
  );
}

/**
 * Gentle 3D tilt that follows the pointer — for book covers. Ignored for
 * touch and for reduced motion.
 */
export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 200, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 200, damping: 18 });
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
