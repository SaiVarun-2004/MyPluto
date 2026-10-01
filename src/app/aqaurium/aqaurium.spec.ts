import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Aqaurium } from './aqaurium';

describe('Aqaurium', () => {
  let component: Aqaurium;
  let fixture: ComponentFixture<Aqaurium>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Aqaurium],
    }).compileComponents();

    fixture = TestBed.createComponent(Aqaurium);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
