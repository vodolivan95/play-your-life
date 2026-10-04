import type { BuildingState } from '../city';
const palettes = {
  coastal: {
    wall: '#f2f7ff',
    side: '#d9ecff',
    floor: '#d8d6c9',
    accent: '#428eef',
  },
  tropical: {
    wall: '#fff4df',
    side: '#e5f0da',
    floor: '#d9c19c',
    accent: '#45a788',
  },
  modern: {
    wall: '#edf0f6',
    side: '#d7e0ee',
    floor: '#bccbd9',
    accent: '#7567d5',
  },
};
export default function RoomScene({
  id,
  building,
  icon,
}: {
  id: string;
  building: BuildingState;
  icon: string;
}) {
  const p = palettes[building.style];
  return (
    <svg
      viewBox="0 0 900 600"
      className="building-room-art"
      role="img"
      aria-label={`Интерьер: ${building.style}, улучшение ${building.tier}`}
    >
      <defs>
        <linearGradient id="room-sky" x2="0" y2="1">
          <stop stopColor="#c7eaff" />
          <stop offset="1" stopColor="#f3fbff" />
        </linearGradient>
        <linearGradient id="room-grass">
          <stop stopColor="#a6d6a7" />
          <stop offset="1" stopColor="#61b690" />
        </linearGradient>
        <filter id="room-shadow">
          <feDropShadow
            dx="0"
            dy="13"
            stdDeviation="10"
            floodColor="#30779a"
            floodOpacity=".18"
          />
        </filter>
      </defs>
      <rect width="900" height="600" rx="25" fill="url(#room-sky)" />
      <circle cx="785" cy="75" r="35" fill="#fff1bc" />
      <path d="M0 390Q180 315 370 380T900 370V600H0Z" fill="#85d5df" />
      <path d="M0 425Q190 367 420 414T900 402V600H0Z" fill="#a3e2e6" />
      <ellipse
        cx="450"
        cy="518"
        rx="380"
        ry="69"
        fill="#71b5b0"
        opacity=".22"
      />
      <path d="M57 385 443 214 849 410 473 596Z" fill="url(#room-grass)" />
      <path d="M77 405 445 245 824 411 476 562Z" fill="#e7dcba" />
      <g filter="url(#room-shadow)">
        <path d="M100 145 430 40 430 251 100 371Z" fill={p.wall} />
        <path d="M430 40 800 153 800 378 430 251Z" fill={p.side} />
        <path d="M100 371 430 251 800 378 475 562Z" fill={p.floor} />
        <path d="M100 371 475 562 475 580 100 389Z" fill="#adbaac" />
        <path d="M475 562 800 378 800 396 475 580Z" fill="#96aeb0" />
        <path
          d="M100 145 430 40 800 153"
          fill="none"
          stroke="white"
          strokeWidth="12"
        />
        <path
          d="M100 370 430 251 800 378"
          fill="none"
          stroke={p.accent}
          strokeWidth="7"
        />
        <path
          d="M250 310 617 467M370 273 710 415M137 389 473 269M226 437 574 307M336 490 675 341"
          stroke="#ffffff55"
          strokeWidth="2"
        />
        <path
          d="M562 125 723 176 723 286 562 233Z"
          fill="#91d9ed"
          stroke="white"
          strokeWidth="9"
        />
        <path d="M642 151V258M562 181 723 233" stroke="white" strokeWidth="5" />
        <path d="M582 217 622 171 651 209 677 192 713 252" fill="#92cbbc" />
        <path
          d="M156 166 297 121 297 230 156 279Z"
          fill={p.accent}
          opacity=".85"
        />
        <path d="M165 176 290 135" stroke="#ffffff55" strokeWidth="6" />
        <text x="225" y="227" textAnchor="middle" fontSize="55">
          {icon}
        </text>
        <ellipse cx="445" cy="410" rx="145" ry="40" fill="#667c8925" />
        <path
          d="M350 351 491 300 611 350 475 415Z"
          fill={p.accent}
          opacity=".2"
        />
        {['growth', 'english', 'finance', 'tasks'].includes(id) && (
          <g>
            <path d="M333 331 473 278 612 338 473 401Z" fill="#f4dfb7" />
            <path d="M333 331V346L473 417V401Z" fill="#c79a69" />
            <path d="M473 401V417L612 354V338Z" fill="#af8259" />
            <path
              d="M357 355V415M573 365V427"
              stroke="#678093"
              strokeWidth="9"
            />
            {id === 'english' ? (
              <>
                <circle cx="474" cy="289" r="35" fill="#67b6ed" />
                <path
                  d="M447 280 467 264 492 274 492 293 477 310 461 303Z"
                  fill="#75d6b3"
                />
                <path d="M474 324V340" stroke="#d8b871" strokeWidth="7" />
              </>
            ) : (
              <>
                <path
                  d="M448 249 527 276 527 333 448 307Z"
                  fill="#397499"
                  stroke="#c7d4e4"
                  strokeWidth="5"
                />
                <path d="M465 266 510 282 510 312 465 297Z" fill="#9ae5ed" />
                <path d="M475 329 503 343" stroke="#607788" strokeWidth="8" />
              </>
            )}
            <path d="M386 320 410 312 440 325 417 336Z" fill="white" />
            <path d="M392 322 416 331" stroke={p.accent} strokeWidth="3" />
          </g>
        )}
        {(id === 'growth' || id === 'finance') && (
          <g>
            <path d="M624 267 701 291V384L624 356Z" fill="#dab986" />
            <path
              d="M637 290 690 308M637 323 690 341M637 353 690 370"
              stroke="#9e794d"
              strokeWidth="5"
            />
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={`M${637 + i * 11} ${285 + i * 3}v24`}
                stroke={
                  ['#4da99b', '#efbb69', '#ec9198', '#898bd3', '#53a5df'][i]
                }
                strokeWidth="8"
              />
            ))}
          </g>
        )}
        {id === 'health' && (
          <g>
            <path d="M320 324 457 272 610 339 471 405Z" fill="#e4efff" />
            <path d="M320 324V356L471 436V405Z" fill="#c8daea" />
            <path d="M471 405V436L610 365V339Z" fill="#a1c4d9" />
            <path d="M357 310 405 291 448 310 400 332Z" fill="white" />
            <path d="M366 329 470 286 581 337 474 389Z" fill="#7fd5c1" />
            <path
              d="M331 357V396M595 371V410"
              stroke="#738ca1"
              strokeWidth="8"
            />
          </g>
        )}
        {id === 'sport' && (
          <g>
            <path d="M340 355 457 300 556 342 442 407Z" fill="#4b6685" />
            <path d="M355 352 457 311 537 344 440 395Z" fill="#708eaf" />
            <path
              d="M477 289V245L542 266V326"
              fill="none"
              stroke="#becbdb"
              strokeWidth="12"
            />
            <path d="M466 246 523 264" stroke="#324c69" strokeWidth="12" />
            <path d="M574 398 643 368" stroke="#597086" strokeWidth="10" />
            <circle cx="575" cy="398" r="19" fill="#f1a246" />
            <circle cx="642" cy="368" r="19" fill="#f1a246" />
          </g>
        )}
        {id === 'together' && (
          <g>
            <path
              d="M327 336 467 283 620 346 477 414Z"
              fill="#f3deae"
              stroke="#d5b67e"
              strokeWidth="6"
            />
            <path
              d="M351 355V422M600 358V430"
              stroke="#a68657"
              strokeWidth="8"
            />
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${i * 76} ${i * 26})`}>
                <path d="M306 380V425L335 438V392Z" fill={p.accent} />
                <path d="M306 425 335 438 361 421 334 407Z" fill="#b0cfdd" />
              </g>
            ))}
          </g>
        )}
        {id === 'driving' && (
          <g>
            <path
              d="M330 372 385 322 478 296 562 337 613 355 604 394 448 437 333 407Z"
              fill={p.accent}
            />
            <path d="M394 325 478 309 548 339 460 363Z" fill="#b6e8f3" />
            <path d="M340 379 426 409" stroke="#ffffffaa" strokeWidth="5" />
            <ellipse cx="391" cy="415" rx="22" ry="29" fill="#344e6c" />
            <ellipse cx="556" cy="405" rx="22" ry="29" fill="#344e6c" />
            <ellipse cx="391" cy="415" rx="10" ry="15" fill="#b9cfdf" />
            <ellipse cx="556" cy="405" rx="10" ry="15" fill="#b9cfdf" />
          </g>
        )}
        {id === 'hobby' && (
          <g>
            <path
              d="M389 420 452 271 501 436M452 271V445"
              fill="none"
              stroke="#b49167"
              strokeWidth="9"
            />
            <path
              d="M414 268 495 290 485 365 406 341Z"
              fill="#fffbef"
              stroke="#d5be8e"
              strokeWidth="7"
            />
            <path
              d="M421 319 438 293 458 326 475 315 478 347 419 331Z"
              fill="#f4a1b1"
            />
            <circle cx="465" cy="309" r="10" fill="#f2ce70" />
            <path d="M550 367 587 350 621 374 585 397Z" fill="#8bbdaf" />
          </g>
        )}
        {building.tier >= 2 && (
          <>
            <path d="M732 372V250" stroke="#7eaaa3" strokeWidth="8" />
            <ellipse cx="732" cy="253" rx="27" ry="34" fill="#80bd99" />
            <path d="M748 231 719 269" stroke="#639f80" strokeWidth="6" />
            <circle cx="312" cy="107" r="12" fill="#ffe1a0" />
            <path d="M312 119V160" stroke="#c9a466" strokeWidth="3" />
            <path d="M114 372 440 495" stroke="#fff1ce" strokeWidth="8" />
          </>
        )}
        {building.tier >= 3 && (
          <>
            <path
              d="M119 140 434 34 804 145"
              stroke="#dfbf7b"
              strokeWidth="17"
              fill="none"
            />
            <path
              d="M113 330 113 372M151 344 151 388M188 359 188 407"
              stroke="white"
              strokeWidth="7"
            />
            <path d="M113 330 201 365" stroke="white" strokeWidth="7" />
            <path d="M485 540 805 362" stroke="#edc665" strokeWidth="10" />
            <text x="769" y="198" fill="#d6a83b" fontSize="22">
              ★
            </text>
          </>
        )}
      </g>
      <g fill="#73c392">
        <ellipse cx="70" cy="369" rx="34" ry="25" />
        <ellipse cx="834" cy="392" rx="37" ry="24" />
      </g>
    </svg>
  );
}
