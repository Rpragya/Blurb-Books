import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHome } from '../../api/queries';
import type { BookSummary } from '../../api/types';
import { PageHeading, usePageTitle } from '../../app/focus';
import { toSearchParams } from '../../domain/search';
import type { GenreId } from '../../domain/types';
import { Button, ButtonLink } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { ErrorState } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { EASE_OUT_EXPO, Reveal, Stagger, StaggerItem } from '../../ui/motion';
import { AvailabilityBadge } from '../../ui/Status';

const COLLECTIONS: { genre: GenreId; title: string; caption: string; image: string }[] = [
  { genre: 'literary', title: 'Fiction', caption: 'Imaginary worlds.\nReal connections.', image: 'fiction' },
  { genre: 'mystery', title: 'Mystery', caption: 'Questions that\nkeep you turning.', image: 'mystery' },
  { genre: 'science-fiction', title: 'Science', caption: 'Big ideas.\nBrighter tomorrows.', image: 'science' },
];

export function WelcomePage() {
  usePageTitle('A world between the covers');
  const home = useHome();
  return (
    <div className="landing landing--reference">
      <LibraryHero />
      <div className="landing__sections">
        <section id="our-library" className="container story-board" aria-labelledby="story-heading">
          <Reveal className="story-board__copy">
            <p className="board-label">Our library</p>
            <h2 id="story-heading">Find a story<br />that stays with you.</h2>
            <p>From timeless classics to contemporary voices, Blurb Books helps you discover great reads, right here in your library.</p>
            <ButtonLink to="/explore" variant="secondary" iconEnd="arrowRight">Learn more</ButtonLink>
          </Reveal>
          <Reveal className="story-board__image" delay={0.1}>
            <img src="/images/generated/reading-room.webp" alt="A reader enjoying a book beside a sunlit window in a warm, wood-lined library" loading="lazy" width="1200" height="675" />
            <span className="story-board__caption">A little quiet. A whole new world.</span>
          </Reveal>
        </section>

        <section id="genres" className="container genre-board" aria-labelledby="genres-heading">
          <h2 id="genres-heading" className="visually-hidden">Explore genres</h2>
          <Stagger as="ul" className="genre-board__grid" stagger={0.1}>
            {COLLECTIONS.map(({ genre, title, caption, image }) => <StaggerItem as="li" key={genre}>
              <Link to={`/search?${toSearchParams({ genres: [genre] })}`} className={`genre-board__card genre-board__card--${image}`}>
                <img src={`/images/generated/genre-${image}.webp`} alt="" loading="lazy" width="900" height="450" />
                <div><h3>{title}</h3><p>{caption}</p></div>
                <span className="genre-board__arrow" aria-hidden="true"><Icon name="arrowUpRight" size={19} /></span>
              </Link>
            </StaggerItem>)}
          </Stagger>
        </section>

        {home.isError && !home.data && <div className="container"><ErrorState error={home.error} onRetry={() => home.refetch()} /></div>}
        <StaffPicks books={home.data?.staffPicks} />

        <section className="container shelf-board" aria-labelledby="shelf-heading">
          <Reveal className="shelf-board__inner">
            <div className="shelf-board__icon"><Icon name="shelf" size={34} /></div>
            <div><p className="board-label">From screen to shelf</p><h2 id="shelf-heading">Found your next chapter?</h2><p>Preview a few pages. Save a favourite. We’ll guide you to the right shelf.</p></div>
            <ButtonLink to="/search" variant="primary" iconEnd="arrowRight">Discover the collection</ButtonLink>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

function LibraryHero() {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['0%', '15%']);
  return <section ref={ref} className="hero-x" aria-labelledby="hero-title">
    <motion.div className="hero-x__media" style={{ y: imageY }} aria-hidden="true">
      <img src="/images/generated/library-hero-1800.webp" srcSet="/images/generated/library-hero-1000.webp 1000w, /images/generated/library-hero-1800.webp 1800w" sizes="100vw" alt="" {...{ fetchpriority: 'high' }} width="1800" height="1013" />
    </motion.div>
    <div className="hero-x__scrim" aria-hidden="true" />
    <motion.div className="hero-x__content container" initial={{ opacity: 0, y: reduce ? 0 : 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}>
      <span className="hero-x__rule" aria-hidden="true" />
      <PageHeading id="hero-title" className="hero-x__title">A world between<br />the covers.</PageHeading>
      <p className="hero-x__lede">Search the library. Find new perspectives. Read what stays with you.</p>
      <form role="search" className="hero-x__search" onSubmit={event => { event.preventDefault(); navigate(`/search?${toSearchParams({ q })}`); }}>
        <label htmlFor="hero-q" className="visually-hidden">Search books, authors, or themes</label>
        <Icon name="search" size={22} />
        <input id="hero-q" type="search" placeholder="Search books, authors, or themes" value={q} onChange={event => setQ(event.target.value)} autoComplete="off" enterKeyHint="search" />
        <Button type="submit" variant="primary">Search</Button>
      </form>
      <div className="hero-x__ctas"><a href="#genres" className="btn btn--primary btn--lg">Explore genres</a><ButtonLink to="/search" variant="ghost" size="lg" className="btn--on-dark">Find a book</ButtonLink></div>
    </motion.div>
    <a href="#our-library" className="hero-x__scroll"><span>Scroll to explore</span><Icon name="arrowDown" size={22} /></a>
    <span className="hero-board__corner">A PLACE FOR EVERY STORY.</span>
  </section>;
}

function StaffPicks({ books }: { books?: BookSummary[] }) {
  return <section className="container picks-board" aria-labelledby="picks-heading">
    <Reveal className="picks-board__head"><h2 id="picks-heading" className="board-label">Staff picks</h2><p>Handpicked by our librarians</p></Reveal>
    <Stagger as="ul" className="picks-board__grid" stagger={0.12}>
      {books ? books.slice(0, 3).map(({ edition, availability }) => <StaggerItem as="li" key={edition.id} className="pick-board">
        <Link to={`/books/${edition.id}`} className="pick-board__cover" aria-label={`Discover ${edition.title}`}><Cover edition={edition} size="md" /></Link>
        <div className="pick-board__body"><h3><Link to={`/books/${edition.id}`}>{edition.title}</Link></h3><p className="pick-board__author">{edition.authors.join(', ')}</p><p className="pick-board__description">{edition.description}</p><AvailabilityBadge availability={availability} /><Link to={`/books/${edition.id}`} className="pick-board__link">View details <Icon name="arrowRight" size={15} /></Link></div>
      </StaggerItem>) : [0, 1, 2].map(index => <StaggerItem as="li" key={index} className="pick-board" aria-hidden="true"><div className="cover cover--md skeleton" /><div className="skeleton skeleton--line" /></StaggerItem>)}
    </Stagger>
  </section>;
}
