import type { Area } from '../model/types';
export { areaPoints } from '../model/area';

/** The area outline as a rect or polygon element with the given class. */
export function AreaShapeEl({ area, className, ...rest }: { area: Area; className: string } & React.SVGProps<SVGRectElement & SVGPolygonElement>) {
  if (area.shape.kind === 'polygon')
    return <polygon className={className} points={area.shape.points.map((p) => p.join(',')).join(' ')} {...(rest as React.SVGProps<SVGPolygonElement>)} />;
  return <rect className={className} x={0} y={0} width={area.widthCm} height={area.lengthCm} {...(rest as React.SVGProps<SVGRectElement>)} />;
}

/** <clipPath> so the grid and background stay inside a free-shaped area. */
export function AreaClip({ area, id }: { area: Area; id: string }) {
  return (
    <clipPath id={id}>
      <AreaShapeEl area={area} className="" />
    </clipPath>
  );
}
