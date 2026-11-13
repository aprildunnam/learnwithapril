const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const carousel of document.querySelectorAll('[data-carousel]')) {
  const track = carousel.querySelector('.feature-track');
  const controls = carousel.querySelector('[data-carousel-controls]');
  const previous = controls.querySelector('[data-prev]');
  const next = controls.querySelector('[data-next]');

  function updateControls() {
    const limit = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft >= limit - 2;
  }

  function advance(direction) {
    const [first, second] = track.children;
    const step = second.offsetLeft - first.offsetLeft;
    track.scrollBy({ left: direction * step, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  previous.addEventListener('click', () => advance(-1));
  next.addEventListener('click', () => advance(1));
  track.addEventListener('scroll', updateControls, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    advance(event.key === 'ArrowLeft' ? -1 : 1);
  });
  new ResizeObserver(updateControls).observe(track);
  controls.hidden = false;
  updateControls();
}

const gallery = document.querySelector('[data-photo-gallery]');
const viewer = document.querySelector('#photo-viewer');
if (gallery && viewer && typeof viewer.showModal === 'function') {
  const photos = Array.from(gallery.querySelectorAll('figure'));
  const image = viewer.querySelector('.viewer-image');
  const caption = viewer.querySelector('#photo-caption');
  let current = 0;

  function showPhoto(index) {
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    const source = photo.querySelector('img');
    image.src = source.src;
    image.alt = source.alt;
    caption.textContent = `${photo.querySelector('figcaption').textContent} · ${current + 1} of ${photos.length}`;
  }

  for (const [index, photo] of photos.entries()) {
    const thumbnail = photo.querySelector('img');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'photo-trigger';
    trigger.setAttribute('aria-label', `View photo: ${thumbnail.alt}`);
    thumbnail.before(trigger);
    trigger.append(thumbnail);
    trigger.addEventListener('click', () => {
      showPhoto(index);
      viewer.showModal();
    });
  }

  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.querySelector('.viewer-prev').addEventListener('click', () => showPhoto(current - 1));
  viewer.querySelector('.viewer-next').addEventListener('click', () => showPhoto(current + 1));
  viewer.addEventListener('click', event => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    showPhoto(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
}

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (reducedMotion.matches) continue;
      target.animate(
        [{ opacity: 0.55, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 460, easing: 'cubic-bezier(.2,.7,.2,1)' }
      );
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
}
