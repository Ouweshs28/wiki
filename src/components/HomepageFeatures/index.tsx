import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
    {
        title: 'Backend Development',
        Svg: require('@site/static/img/undraw_programming_65t2.svg').default,
        description: (
            <>
                Expertise in building scalable, high-performance backend systems using Java, Spring Boot, and microservices architecture.
            </>
        ),
    },
    {
        title: 'System Design',
        Svg: require('@site/static/img/undraw_building-a-website_1wrp.svg').default,
        description: (
            <>
                Experience in designing and optimizing distributed systems, APIs, and database schemas for optimal performance.
            </>
        ),
    },
    {
        title: 'Leadership & Mentorship',
        Svg: require('@site/static/img/undraw_teacher_s628.svg').default,
        description: (
            <>
                Passionate about mentoring junior developers and leading technical teams to deliver high-quality software solutions.
            </>
        ),
    },
];

function Feature({title, Svg, description}: Readonly<FeatureItem>) {
    return (
        <div className={clsx('col col--4 padding-vert--md')}>
            <div className="text--center">
                <Svg className={styles.featureSvg} role="img" />
            </div>
            <div className="text--center padding-horiz--md">
                <Heading as="h3" className="margin-bottom--sm">{title}</Heading>
                <p className="text--justify">{description}</p>
            </div>
        </div>
    );
}

export default function HomepageFeatures(): ReactNode {
    return (
        <section className={styles.features}>
            <div className="container">
                <div className="row">
                    <div className="col col--10 col--offset-1">
                        <div className="text--center margin-bottom--xl">
                            <h2>Areas of Expertise</h2>
                            <p className="margin-top--md">
                                With over 4 years of professional experience, I've worked on a variety of projects
                                and technologies. Here are some of my key areas of expertise.
                            </p>
                        </div>
                        <div className="row">
                            {FeatureList.map((props, idx) => (
                                <Feature key={idx} {...props} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
