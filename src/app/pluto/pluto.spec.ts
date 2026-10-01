import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pluto } from './pluto';

describe('Pluto', () => {
  let component: Pluto;
  let fixture: ComponentFixture<Pluto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pluto],
    }).compileComponents();

    fixture = TestBed.createComponent(Pluto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
